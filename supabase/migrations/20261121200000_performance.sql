-- =============================================================================
-- Launch readiness: speed at scale
-- =============================================================================
-- Plain-language summary
--   Measured with 20,000 families (4x the build plan's 5,000), 30,000 children,
--   795,000 vaccination rows, 400,000 events and 750,000 supply items
--   (supabase/perf/). Every parent screen query already took under 1 ms. Three
--   things grew with the number of families, and are fixed here:
--   * The 5-minute reminder job read every vaccination row and every past
--     event each time. Now it only looks at the next 14 days of vaccinations
--     and skips past one-off events, using indexes made for exactly that.
--   * The 6 pm "running low" job ran its full check every 5 minutes until
--     midnight (72 times a day). Now it does the work once a day.
--   * Deleting a family had to search all supply items to find its own.
--     One index on (family, running low) now serves both that and Home.
-- =============================================================================

-- Vaccination doses still due, by date (the reminder job reads a 15-day window).
create index child_vaccinations_due_idx on public.child_vaccinations (due_date) where status = 'due';

-- Repeating events with a reminder (one-off ones use events_family_starts_idx).
drop index public.events_with_reminder_idx;
create index events_reminder_repeating_idx on public.events (starts_at) where remind_minutes_before is not null and repeat <> 'none';

-- Supplies by family: Home's "running low" list and deleting a family.
drop index public.supply_items_low_idx;
create index supply_items_family_low_idx on public.supply_items (family_id, is_low);

-- Which once-a-day jobs have already run today.
create table public.job_runs (
  job  text not null,
  day  date not null,
  at   timestamptz not null default now(),
  primary key (job, day)
);
alter table public.job_runs enable row level security;
revoke all on public.job_runs from anon, authenticated;

create or replace function public.queue_due_reminders()
returns int
language plpgsql security definer set search_path = ''
as $$
declare
  kw_now timestamp := public.kuwait_now();
  kw_today date := kw_now::date;
  n int := 0;
  added int;
begin
  -- Vaccines: N days before (default 3) and on the day, from 09:00 Kuwait time.
  if kw_now::time >= time '09:00' then
    insert into public.notification_log (user_id, kind, ref_id, occurrence, title, body, url, silent)
    select fm.user_id,
           case when cv.due_date = kw_today then 'vaccine_today' else 'vaccine_soon' end,
           cv.id,
           cv.due_date::timestamptz,
           case when p.locale = 'en' then 'Vaccination reminder' else 'تذكير بالتطعيم' end,
           case
             when cv.due_date = kw_today and p.locale = 'en' then c.first_name || ' has a vaccination due today.'
             when cv.due_date = kw_today then 'لدى ' || c.first_name || ' تطعيم اليوم.'
             when p.locale = 'en' then c.first_name || ' has a vaccination in ' || (cv.due_date - kw_today) || ' days.'
             else 'لدى ' || c.first_name || ' تطعيم بعد ' || (cv.due_date - kw_today) || ' أيام.'
           end,
           '/dose/' || cv.id,
           false
    from public.child_vaccinations cv
    join public.children c on c.id = cv.child_id
    join public.family_members fm on fm.family_id = cv.family_id
    join public.profiles p on p.id = fm.user_id
    left join public.notification_settings ns on ns.user_id = fm.user_id
    where cv.status = 'due'
      and coalesce(ns.vaccines, true)
      and (cv.due_date = kw_today
           or cv.due_date = kw_today + coalesce(ns.vaccine_days_before, 3))
      -- the setting is at most 14 days: this bound lets the database use an index
      and cv.due_date between kw_today and kw_today + 14
      and exists (select 1 from public.device_tokens d where d.user_id = fm.user_id)
    on conflict do nothing;
    get diagnostics added = row_count;
    n := n + added;
  end if;

  -- Events: when "remind N minutes before" has been reached.
  insert into public.notification_log (user_id, kind, ref_id, occurrence, title, body, url, silent)
  select fm.user_id, 'event', e.id, o.occ,
         e.title,
         case when p.locale = 'en'
              then 'Starts at ' || to_char(o.occ at time zone 'Asia/Kuwait', 'HH24:MI')
                   || coalesce(' · ' || c.first_name, '')
              else 'يبدأ الساعة ' || to_char(o.occ at time zone 'Asia/Kuwait', 'HH24:MI')
                   || coalesce(' · ' || c.first_name, '')
         end,
         '/event/' || e.id,
         public.in_quiet_hours(coalesce(ns.quiet_start, time '22:00'), coalesce(ns.quiet_end, time '07:00'), kw_now::time)
  from public.events e
  cross join lateral (
    -- look 10 minutes back too, so a reminder "at start" is not skipped when
    -- the 5-minute job runs just after the start time
    select public.next_occurrence(e.starts_at, e.repeat, e.repeat_until, now() - interval '10 minutes') as occ
  ) o
  left join public.children c on c.id = e.child_id
  join public.family_members fm on fm.family_id = e.family_id
  join public.profiles p on p.id = fm.user_id
  left join public.notification_settings ns on ns.user_id = fm.user_id
  where e.remind_minutes_before is not null
    and e.starts_at <= now() + interval '8 days'
    -- one-off events in the past can't need a reminder: skip them without
    -- working out their next date (repeating events still need the check)
    and (e.repeat <> 'none' or e.starts_at >= now() - interval '10 minutes')
    and o.occ is not null
    and o.occ - make_interval(mins => e.remind_minutes_before) <= now()
    and coalesce(ns.events, true)
    and exists (select 1 from public.device_tokens d where d.user_id = fm.user_id)
  on conflict do nothing;
  get diagnostics added = row_count;
  return n + added;
end;
$$;
revoke execute on function public.queue_due_reminders() from public, anon, authenticated;

create or replace function public.queue_supply_reminders()
returns int
language plpgsql security definer set search_path = ''
as $$
declare
  kw_now timestamp := public.kuwait_now();
  added int;
begin
  if kw_now::time < time '18:00' then
    return 0;
  end if;
  -- Once a day: the 5-minute job calls this until midnight, but only the
  -- first call after 18:00 does the work.
  insert into public.job_runs (job, day) values ('supply_low', kw_now::date) on conflict do nothing;
  if not found then
    return 0;
  end if;
  insert into public.notification_log (user_id, kind, ref_id, occurrence, title, body, url, silent)
  select fm.user_id, 'supply_low', c.id, kw_now::date::timestamptz,
         case when p.locale = 'en' then 'Supplies running low' else 'مستلزمات قاربت على النفاد' end,
         case when p.locale = 'en'
              then c.first_name || ': ' || s.low || case when s.low = 1 then ' item is' else ' items are' end
                   || ' running low or finished.'
              else c.first_name || ': ' || s.low || ' من المستلزمات قاربت على النفاد أو نفدت.'
         end,
         '/supplies',
         public.in_quiet_hours(coalesce(ns.quiet_start, time '22:00'), coalesce(ns.quiet_end, time '07:00'), kw_now::time)
  from (select child_id, family_id, count(*) as low
        from public.supply_items where is_low group by child_id, family_id) s
  join public.children c on c.id = s.child_id
  join public.family_members fm on fm.family_id = s.family_id
  join public.profiles p on p.id = fm.user_id
  left join public.notification_settings ns on ns.user_id = fm.user_id
  where coalesce(ns.supplies, true)
    and exists (select 1 from public.device_tokens d where d.user_id = fm.user_id)
  on conflict do nothing;
  get diagnostics added = row_count;
  return added;
end;
$$;
revoke execute on function public.queue_supply_reminders() from public, anon, authenticated;

-- Home's "tip of the day": the published tips that fit each of my children,
-- in one request. (Before, Home had to load the children first and then ask
-- for tips: two trips to the server instead of one.) Runs with the parent's
-- own rights, so Row Level Security limits it to their own children.
create or replace function public.my_children_tips()
returns table (child_id uuid, id uuid, section text, title_ar text, title_en text, body_ar text, body_en text)
language sql stable security invoker set search_path = ''
as $$
  select c.id, t.id, t.section, t.title_ar, t.title_en, t.body_ar, t.body_en
  from public.children c
  cross join lateral (
    select (extract(year from age((now() at time zone 'Asia/Kuwait')::date, c.birth_date)) * 12
          + extract(month from age((now() at time zone 'Asia/Kuwait')::date, c.birth_date)))::int as months
  ) a
  join public.tips t on t.status = 'published'
    and a.months between t.min_age_months and t.max_age_months
    and (t.only_gender is null or t.only_gender = c.gender)
  order by c.id, t.sort_order, t.id
$$;
revoke execute on function public.my_children_tips() from public, anon;
grant execute on function public.my_children_tips() to authenticated;
