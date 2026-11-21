-- =============================================================================
-- Step 4: supplies tracker, suggested items by age, brands sold in Kuwait
-- =============================================================================
-- Plain-language summary
--   * Each child has their own list of supplies (milk, diapers, wipes,
--     thermometer, teethers, toys, clothes...) with a quantity and a "low"
--     level. Both parents share it.
--   * A suggested list by age helps parents start. Suggestions change by
--     gender only for clothing, milk and diapers (Ezzo's decision).
--   * Brands are a neutral, alphabetical list of brands sold in Kuwait's big
--     supermarkets. No paid ranking, and no promotions next to infant formula.
--   * Once a day at 6 pm (Kuwait time) a parent gets one reminder per child
--     if something is running low or finished.
--   * Suggestions and brands are our content: everyone can read the published
--     ones, and only our team (the admin panel, a later step) can change them.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Content: brands and suggested items (read-only for parents)
-- -----------------------------------------------------------------------------
create table public.brands (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null check (kind in ('diapers', 'formula', 'wipes', 'baby_care')),
  name_ar    text not null check (char_length(name_ar) between 1 and 60),
  name_en    text not null check (char_length(name_en) between 1 and 60),
  status     text not null default 'draft' check (status in ('draft', 'published')),
  -- true until someone has checked the brand on the shelf in Kuwait
  needs_store_check boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (kind, name_en)
);

create table public.supply_suggestions (
  id              uuid primary key default gen_random_uuid(),
  category        text not null check (category in ('feeding', 'diapering', 'health', 'teething', 'play', 'clothing')),
  name_ar         text not null check (char_length(name_ar) between 1 and 80),
  name_en         text not null check (char_length(name_en) between 1 and 80),
  hint_ar         text check (char_length(hint_ar) <= 300),
  hint_en         text check (char_length(hint_en) <= 300),
  min_age_months  int not null check (min_age_months between 0 and 131),
  max_age_months  int not null check (max_age_months between 0 and 131),
  -- Gender only changes clothing, milk and diaper suggestions.
  only_gender     text check (only_gender in ('girl', 'boy')),
  brand_kind      text check (brand_kind in ('diapers', 'formula', 'wipes', 'baby_care')),
  is_formula      boolean not null default false,
  default_unit    text not null default 'pcs' check (default_unit in ('pcs', 'packs', 'boxes', 'bottles', 'tins')),
  default_low     int not null default 1 check (default_low between 0 and 999),
  sort_order      int not null default 0,
  status          text not null default 'draft' check (status in ('draft', 'published')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (min_age_months <= max_age_months),
  check (only_gender is null or category in ('clothing', 'feeding', 'diapering'))
);
create index supply_suggestions_age_idx on public.supply_suggestions (min_age_months, max_age_months) where status = 'published';

alter table public.brands enable row level security;
alter table public.supply_suggestions enable row level security;
revoke all on public.brands, public.supply_suggestions from anon, authenticated;
grant select on public.brands, public.supply_suggestions to anon, authenticated;
create policy brands_read on public.brands for select to anon, authenticated using (status = 'published');
create policy supply_suggestions_read on public.supply_suggestions for select to anon, authenticated using (status = 'published');
create trigger brands_touch before update on public.brands for each row execute function public.touch_updated_at();
create trigger supply_suggestions_touch before update on public.supply_suggestions for each row execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- 2. Each child's supplies
-- -----------------------------------------------------------------------------
create table public.supply_items (
  id             uuid primary key default gen_random_uuid(),
  family_id      uuid not null references public.families (id) on delete cascade,
  child_id       uuid not null,
  category       text not null check (category in ('feeding', 'diapering', 'health', 'teething', 'play', 'clothing')),
  name           text not null check (char_length(btrim(name)) between 1 and 80 and name !~ '[\u0000-\u001F‪-‮⁦-⁩]'),
  brand          text check (char_length(brand) <= 60 and brand !~ '[\u0000-\u001F‪-‮⁦-⁩]'),
  size           text check (char_length(size) <= 40 and size !~ '[\u0000-\u001F‪-‮⁦-⁩]'),
  quantity       int not null default 0 check (quantity between 0 and 9999),
  unit           text not null default 'pcs' check (unit in ('pcs', 'packs', 'boxes', 'bottles', 'tins')),
  low_threshold  int not null default 1 check (low_threshold between 0 and 999),
  -- true when quantity is at or below the "low" level (kept by the database)
  is_low         boolean generated always as (quantity <= low_threshold) stored,
  suggestion_id  uuid references public.supply_suggestions (id) on delete set null,
  created_by     uuid default auth.uid() references auth.users (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  foreign key (child_id, family_id) references public.children (id, family_id) on delete cascade
);
-- Supplies screen: WHERE child_id = ? ORDER BY category, name
create index supply_items_child_idx on public.supply_items (child_id, category, name);
-- Home "running low": WHERE family_id = ? AND is_low
create index supply_items_low_idx on public.supply_items (family_id) where is_low;
-- One suggestion is added once per child
create unique index supply_items_child_suggestion_idx on public.supply_items (child_id, suggestion_id) where suggestion_id is not null;

alter table public.supply_items enable row level security;
revoke all on public.supply_items from anon, authenticated;
grant select, delete on public.supply_items to authenticated;
grant insert (family_id, child_id, category, name, brand, size, quantity, unit, low_threshold, suggestion_id)
  on public.supply_items to authenticated;
grant update (category, name, brand, size, quantity, unit, low_threshold) on public.supply_items to authenticated;
create policy supply_items_select on public.supply_items for select to authenticated
  using (family_id = (select public.my_family_id()));
create policy supply_items_insert on public.supply_items for insert to authenticated
  with check (family_id = (select public.my_family_id()));
create policy supply_items_update on public.supply_items for update to authenticated
  using (family_id = (select public.my_family_id()))
  with check (family_id = (select public.my_family_id()));
create policy supply_items_delete on public.supply_items for delete to authenticated
  using (family_id = (select public.my_family_id()));
create trigger supply_items_touch before update on public.supply_items
  for each row execute function public.touch_updated_at();

-- At most 300 items per child (stops one account filling the database).
create or replace function public.enforce_supply_limit()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if (select count(*) from public.supply_items where child_id = new.child_id) >= 300 then
    raise exception 'a child can have at most 300 supply items' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke execute on function public.enforce_supply_limit() from public, anon, authenticated;
create trigger supply_items_limit before insert on public.supply_items
  for each row execute function public.enforce_supply_limit();

-- -----------------------------------------------------------------------------
-- 3. "Running low" reminders, once a day at 18:00 Kuwait time
-- -----------------------------------------------------------------------------
alter table public.notification_settings add column supplies boolean not null default true;
grant insert (supplies), update (supplies) on public.notification_settings to authenticated;

alter table public.notification_log drop constraint notification_log_kind_check;
alter table public.notification_log add constraint notification_log_kind_check
  check (kind in ('vaccine_soon', 'vaccine_today', 'event', 'supply_low'));

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

-- Same job name: this replaces the step 3 schedule with one that also checks supplies.
select cron.schedule(
  'yahal-reminders',
  '*/5 * * * *',
  $$ select public.queue_due_reminders(); select public.queue_supply_reminders(); select public.send_queued_notifications(); $$
);
