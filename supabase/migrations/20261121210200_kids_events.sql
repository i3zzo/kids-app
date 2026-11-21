-- =============================================================================
-- Kids' events (dated, so past ones drop off) and "new and trending" places
-- =============================================================================

create table public.kids_events (
  id                uuid primary key default gen_random_uuid(),
  -- Stable key, so a re-import updates the row instead of adding a copy.
  ref               text unique check (ref ~ '^[a-z0-9-]{3,80}$'),
  title_ar          text not null check (char_length(title_ar) between 1 and 120),
  title_en          text not null check (char_length(title_en) between 1 and 120),
  venue_ar          text check (char_length(venue_ar) <= 120),
  venue_en          text check (char_length(venue_en) <= 120),
  governorate       text check (governorate in ('capital', 'hawalli', 'farwaniya', 'mubarak_al_kabeer', 'ahmadi', 'jahra')),
  area_ar           text check (char_length(area_ar) <= 60),
  area_en           text check (char_length(area_en) <= 60),
  description_ar    text check (char_length(description_ar) <= 600),
  description_en    text check (char_length(description_en) <= 600),
  starts_on         date not null,
  ends_on           date not null,
  hours_ar          text check (char_length(hours_ar) <= 120),
  hours_en          text check (char_length(hours_en) <= 120),
  min_age_months    int not null default 0 check (min_age_months between 0 and 131),
  max_age_months    int not null default 131 check (max_age_months between 0 and 131),
  price_min_kwd     numeric(9,3) check (price_min_kwd >= 0),
  price_max_kwd     numeric(9,3) check (price_max_kwd >= 0),
  price_note_ar     text check (char_length(price_note_ar) <= 200),
  price_note_en     text check (char_length(price_note_en) <= 200),
  url               text check (url ~ '^https://'),
  place_id          uuid references public.places (id) on delete set null,
  source_url        text not null check (source_url ~ '^https://'),
  source_checked_on date not null,
  -- null until the team has confirmed the dates with the organiser
  verified_on       date,
  status            text not null default 'draft' check (status in ('draft', 'in_review', 'published')),
  reviewed_by       uuid references auth.users (id) on delete set null,
  reviewed_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (starts_on <= ends_on),
  check (min_age_months <= max_age_months),
  check (price_max_kwd is null or (price_min_kwd is not null and price_max_kwd >= price_min_kwd))
);
-- Events list: published, not yet ended, soonest first.
create index kids_events_current_idx on public.kids_events (ends_on, starts_on, id) where status = 'published';

alter table public.kids_events enable row level security;
revoke all on public.kids_events from anon, authenticated;
grant select on public.kids_events to anon, authenticated;
create policy kids_events_read on public.kids_events for select to anon, authenticated using (status = 'published');
-- Staff: same rules as the other content tables.
grant insert, update, delete on public.kids_events to authenticated;
revoke update (reviewed_by, reviewed_at) on public.kids_events from authenticated;
create policy kids_events_staff_read on public.kids_events for select to authenticated using ((select public.staff_role()) is not null);
create policy kids_events_staff_insert on public.kids_events for insert to authenticated with check ((select public.staff_role()) is not null);
create policy kids_events_staff_update on public.kids_events for update to authenticated
  using ((select public.staff_role()) is not null) with check ((select public.staff_role()) is not null);
create policy kids_events_staff_delete on public.kids_events for delete to authenticated using ((select public.staff_role()) is not null);
create trigger kids_events_review before insert or update on public.kids_events
  for each row execute function public.content_review_guard('general');
create trigger kids_events_touch before update on public.kids_events for each row execute function public.touch_updated_at();
create trigger kids_events_audit after insert or update or delete on public.kids_events
  for each row execute function public.audit_change('id');
