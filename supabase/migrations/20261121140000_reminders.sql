-- =============================================================================
-- Step 3: reminders, repeating events, notification settings
-- =============================================================================
-- Plain-language summary
--   * Events can repeat (daily, weekly, monthly) until a date, and can have a
--     reminder (e.g. 1 hour before).
--   * Each parent's phone registers a "push token" so we can send it
--     notifications. Each parent chooses which reminders they want and their
--     quiet hours.
--   * Every 5 minutes the database itself (pg_cron) finds reminders that are
--     due and sends them through Expo's push service (pg_net). Both parents
--     get them. A reminder is never sent twice.
--   * Privacy: a vaccine reminder says only "<child> has a vaccination in 3
--     days" — the vaccine's name stays inside the app.
-- =============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- -----------------------------------------------------------------------------
-- 1. Repeating events and per-event reminders
-- -----------------------------------------------------------------------------
alter table public.events
  add column repeat text not null default 'none' check (repeat in ('none', 'daily', 'weekly', 'monthly')),
  add column repeat_until date,
  add column remind_minutes_before int check (remind_minutes_before between 0 and 10080);

grant insert (repeat, repeat_until, remind_minutes_before) on public.events to authenticated;
grant update (repeat, repeat_until, remind_minutes_before) on public.events to authenticated;

-- Calendar query for repeating events: WHERE family_id = ? AND repeat <> 'none' AND starts_at < ?
create index events_family_repeating_idx on public.events (family_id, starts_at) where repeat <> 'none';
-- Reminder job: only events that have a reminder
create index events_with_reminder_idx on public.events (starts_at) where remind_minutes_before is not null;

-- -----------------------------------------------------------------------------
-- 2. Phones that receive notifications
-- -----------------------------------------------------------------------------
create table public.device_tokens (
  token      text primary key check (token ~ '^ExponentPushToken\[[A-Za-z0-9_-]+\]$'),
  user_id    uuid not null references auth.users (id) on delete cascade,
  platform   text not null check (platform in ('ios', 'android')),
  locale     text not null default 'ar' check (locale in ('ar', 'en')),
  updated_at timestamptz not null default now()
);
create index device_tokens_user_idx on public.device_tokens (user_id);
alter table public.device_tokens enable row level security;
revoke all on public.device_tokens from anon, authenticated;
grant select, delete on public.device_tokens to authenticated;
create policy device_tokens_own_select on public.device_tokens for select to authenticated
  using (user_id = (select auth.uid()));
create policy device_tokens_own_delete on public.device_tokens for delete to authenticated
  using (user_id = (select auth.uid()));

-- Register this phone for the signed-in parent. If the same phone was used by
-- another account before, it moves to this one (only one account per phone).
create or replace function public.register_device(push_token text, device_platform text, device_locale text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  insert into public.device_tokens (token, user_id, platform, locale)
  values (push_token, uid, device_platform, device_locale)
  on conflict (token) do update
    set user_id = excluded.user_id, platform = excluded.platform,
        locale = excluded.locale, updated_at = now();
  -- Reminders are written in the language the parent uses in the app.
  update public.profiles set locale = device_locale where id = uid and locale <> device_locale;
  -- At most 5 phones per parent: drop the oldest.
  delete from public.device_tokens
  where user_id = uid and token not in (
    select token from public.device_tokens where user_id = uid order by updated_at desc limit 5);
end;
$$;
revoke execute on function public.register_device(text, text, text) from public, anon;
grant execute on function public.register_device(text, text, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 3. Each parent's notification choices
-- -----------------------------------------------------------------------------
create table public.notification_settings (
  user_id             uuid primary key references auth.users (id) on delete cascade,
  vaccines            boolean not null default true,
  events              boolean not null default true,
  vaccine_days_before int not null default 3 check (vaccine_days_before between 0 and 14),
  quiet_start         time not null default '22:00',
  quiet_end           time not null default '07:00',
  updated_at          timestamptz not null default now()
);
alter table public.notification_settings enable row level security;
revoke all on public.notification_settings from anon, authenticated;
grant select, insert (user_id, vaccines, events, vaccine_days_before, quiet_start, quiet_end),
  update (user_id, vaccines, events, vaccine_days_before, quiet_start, quiet_end) -- user_id: needed by upsert; the policy keeps it to your own
  on public.notification_settings to authenticated;
create policy notification_settings_own on public.notification_settings for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create trigger notification_settings_touch before update on public.notification_settings
  for each row execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- 4. The outbox: every reminder, once
-- -----------------------------------------------------------------------------
create table public.notification_log (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  kind        text not null check (kind in ('vaccine_soon', 'vaccine_today', 'event')),
  ref_id      uuid not null,
  occurrence  timestamptz not null,
  title       text not null,
  body        text not null,
  url         text not null,
  silent      boolean not null default false,
  created_at  timestamptz not null default now(),
  sent_at     timestamptz,
  request_id  bigint,
  unique (user_id, kind, ref_id, occurrence)
);
create index notification_log_unsent_idx on public.notification_log (created_at) where sent_at is null;
alter table public.notification_log enable row level security;
revoke all on public.notification_log from anon, authenticated;
grant select on public.notification_log to authenticated;
create policy notification_log_own on public.notification_log for select to authenticated
  using (user_id = (select auth.uid()));

-- Kuwait has no daylight saving, so one fixed zone is enough.
create or replace function public.kuwait_now() returns timestamp
language sql stable set search_path = '' as $$ select (now() at time zone 'Asia/Kuwait') $$;

create or replace function public.in_quiet_hours(s time, e time, t time) returns boolean
language sql immutable set search_path = '' as $$
  select case when s <= e then t >= s and t < e else t >= s or t < e end
$$;

-- Next occurrence of an event at or after `from_ts` (null if none).
-- Worked out on the Kuwait wall clock, so "every month on the 31st at 4 pm"
-- stays at 4 pm Kuwait time, and months without a 31st use their last day
-- (the app's calendar uses the same rule: src/lib/recurrence.ts).
create or replace function public.next_occurrence(
  starts_at timestamptz, rep text, until date, from_ts timestamptz)
returns timestamptz
language plpgsql immutable set search_path = ''
as $$
declare
  s timestamp := starts_at at time zone 'Asia/Kuwait';
  f timestamp := from_ts at time zone 'Asia/Kuwait';
  step interval;
  k bigint;
  occ timestamp;
begin
  if rep = 'none' then
    return case when starts_at >= from_ts then starts_at end;
  end if;
  if s >= f then
    occ := s;
  elsif rep = 'monthly' then
    k := (extract(year from age(f, s)) * 12 + extract(month from age(f, s)))::bigint;
    occ := s + make_interval(months => k::int);
    if occ < f then occ := s + make_interval(months => k::int + 1); end if;
  else
    step := case rep when 'daily' then interval '1 day' else interval '7 days' end;
    k := ceil(extract(epoch from (f - s)) / extract(epoch from step))::bigint;
    occ := s + step * k;
  end if;
  if until is not null and occ::date > until then
    return null;
  end if;
  return occ at time zone 'Asia/Kuwait';
end;
$$;

-- Find reminders that are due now and put them in the outbox.
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

-- Send everything in the outbox through Expo's push service.
create or replace function public.send_queued_notifications()
returns int
language plpgsql security definer set search_path = ''
as $$
declare
  msgs jsonb;
  ids bigint[];
  req bigint;
  access_token text;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
           'to', d.token,
           'title', l.title,
           'body', l.body,
           'sound', case when l.silent then null else 'default' end,
           'priority', case when l.silent then 'normal' else 'high' end,
           'data', jsonb_build_object('url', l.url))), '[]'::jsonb),
         array_agg(distinct l.id)
    into msgs, ids
  from (select * from public.notification_log
        where sent_at is null and created_at > now() - interval '1 day'
        order by id limit 90) l
  join public.device_tokens d on d.user_id = l.user_id;

  if ids is null then
    return 0;
  end if;

  -- Optional Expo access token, kept in Supabase Vault (never in code).
  begin
    select decrypted_secret into access_token from vault.decrypted_secrets where name = 'expo_access_token';
  exception when others then
    access_token := null;
  end;

  select net.http_post(
    url := 'https://exp.host/--/api/v2/push/send',
    body := msgs,
    headers := jsonb_strip_nulls(jsonb_build_object(
      'Content-Type', 'application/json',
      'Accept', 'application/json',
      'Authorization', case when access_token is not null then 'Bearer ' || access_token end))
  ) into req;

  update public.notification_log set sent_at = now(), request_id = req where id = any (ids);
  return cardinality(ids);
end;
$$;
revoke execute on function public.send_queued_notifications() from public, anon, authenticated;

-- Every 5 minutes.
select cron.schedule(
  'yahal-reminders',
  '*/5 * * * *',
  $$ select public.queue_due_reminders(); select public.send_queued_notifications(); $$
);
