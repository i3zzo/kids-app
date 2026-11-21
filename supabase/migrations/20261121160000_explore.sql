-- =============================================================================
-- Step 5: Explore — government guides, directory of places, offers
-- =============================================================================
-- Plain-language summary
--   * Guides: step-by-step government paperwork (birth certificate, civil ID,
--     passport, residency, health centre, school). Each guide is for Kuwaiti
--     families, resident families, or everyone; the app picks the right one
--     from the child's nationality group. Parents tick off steps per child.
--   * Directory: hospitals, clinics, nurseries, schools, activities and
--     stores, with call / WhatsApp / map buttons. Read-only, curated by us.
--   * Offers: toy and kids' clothing offers added by our team, filtered by
--     age and gender. Never infant formula (Ezzo's rule).
--   * All of this is our content: parents can only read what is published.
--     Only guide progress belongs to the family.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Guides
-- -----------------------------------------------------------------------------
create table public.guides (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique check (slug ~ '^[a-z0-9-]{3,60}$'),
  topic             text not null check (topic in ('birth', 'civil_id', 'passport', 'residency', 'health', 'education', 'travel')),
  -- who it is for: Kuwaiti families, resident (expat) families, or everyone
  audience          text not null check (audience in ('kuwaiti', 'resident', 'all')),
  title_ar          text not null check (char_length(title_ar) between 1 and 120),
  title_en          text not null check (char_length(title_en) between 1 and 120),
  summary_ar        text not null check (char_length(summary_ar) <= 400),
  summary_en        text not null check (char_length(summary_en) <= 400),
  source_url        text check (source_url ~ '^https://'),
  -- null until someone has checked every step against the official source
  last_verified_on  date,
  sort_order        int not null default 0,
  status            text not null default 'draft' check (status in ('draft', 'published')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index guides_published_idx on public.guides (sort_order) where status = 'published';

create table public.guide_steps (
  id            uuid primary key default gen_random_uuid(),
  guide_id      uuid not null references public.guides (id) on delete cascade,
  position      int not null check (position between 1 and 50),
  title_ar      text not null check (char_length(title_ar) between 1 and 120),
  title_en      text not null check (char_length(title_en) between 1 and 120),
  body_ar       text not null check (char_length(body_ar) <= 1500),
  body_en       text not null check (char_length(body_en) <= 1500),
  documents_ar  text[] not null default '{}',
  documents_en  text[] not null default '{}',
  link_url      text check (link_url ~ '^https://'),
  unique (guide_id, position)
);

-- Which steps a family has done, per child.
create table public.guide_progress (
  family_id  uuid not null references public.families (id) on delete cascade,
  child_id   uuid not null,
  step_id    uuid not null references public.guide_steps (id) on delete cascade,
  done_at    timestamptz not null default now(),
  primary key (child_id, step_id),
  foreign key (child_id, family_id) references public.children (id, family_id) on delete cascade
);
create index guide_progress_family_idx on public.guide_progress (family_id);

-- -----------------------------------------------------------------------------
-- 2. Directory
-- -----------------------------------------------------------------------------
create table public.places (
  id              uuid primary key default gen_random_uuid(),
  category        text not null check (category in ('activity', 'nursery', 'school', 'hospital', 'paediatrician', 'toy_store', 'clothing_store')),
  name_ar         text not null check (char_length(name_ar) between 1 and 120),
  name_en         text not null check (char_length(name_en) between 1 and 120),
  governorate     text not null check (governorate in ('capital', 'hawalli', 'farwaniya', 'mubarak_al_kabeer', 'ahmadi', 'jahra')),
  area_ar         text check (char_length(area_ar) <= 60),
  area_en         text check (char_length(area_en) <= 60),
  description_ar  text check (char_length(description_ar) <= 600),
  description_en  text check (char_length(description_en) <= 600),
  min_age_months  int not null default 0 check (min_age_months between 0 and 131),
  max_age_months  int not null default 131 check (max_age_months between 0 and 131),
  phone           text check (phone ~ '^\+965[0-9]{8}$'),
  whatsapp        text check (whatsapp ~ '^\+965[0-9]{8}$'),
  instagram       text check (instagram ~ '^[A-Za-z0-9._]{1,30}$'),
  website         text check (website ~ '^https://'),
  maps_url        text check (maps_url ~ '^https://'),
  hours_ar        text check (char_length(hours_ar) <= 120),
  hours_en        text check (char_length(hours_en) <= 120),
  -- null until our team has called or visited to confirm the details
  verified_on     date,
  status          text not null default 'draft' check (status in ('draft', 'published')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (min_age_months <= max_age_months)
);
-- Directory list: WHERE status = 'published' AND category = ? [AND governorate = ?] ORDER BY name
create index places_category_idx on public.places (category, governorate, name_en, id) where status = 'published';

-- -----------------------------------------------------------------------------
-- 3. Offers (toys and kids' clothing only)
-- -----------------------------------------------------------------------------
create table public.offers (
  id              uuid primary key default gen_random_uuid(),
  -- Only toys and clothing: no formula or other breast-milk substitutes.
  category        text not null check (category in ('toys', 'clothing')),
  title_ar        text not null check (char_length(title_ar) between 1 and 120),
  title_en        text not null check (char_length(title_en) between 1 and 120),
  store_ar        text not null check (char_length(store_ar) between 1 and 80),
  store_en        text not null check (char_length(store_en) between 1 and 80),
  details_ar      text check (char_length(details_ar) <= 600),
  details_en      text check (char_length(details_en) <= 600),
  min_age_months  int not null default 0 check (min_age_months between 0 and 131),
  max_age_months  int not null default 131 check (max_age_months between 0 and 131),
  only_gender     text check (only_gender in ('girl', 'boy')),
  starts_on       date not null,
  ends_on         date not null,
  url             text check (url ~ '^https://'),
  place_id        uuid references public.places (id) on delete set null,
  status          text not null default 'draft' check (status in ('draft', 'published')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (min_age_months <= max_age_months),
  check (starts_on <= ends_on)
);
-- Offers feed: published and not yet ended
create index offers_current_idx on public.offers (ends_on, starts_on) where status = 'published';

-- -----------------------------------------------------------------------------
-- 4. Who can do what
-- -----------------------------------------------------------------------------
alter table public.guides enable row level security;
alter table public.guide_steps enable row level security;
alter table public.guide_progress enable row level security;
alter table public.places enable row level security;
alter table public.offers enable row level security;
revoke all on public.guides, public.guide_steps, public.guide_progress, public.places, public.offers from anon, authenticated;

-- Published content: readable by everyone (also before sign-in).
grant select on public.guides, public.guide_steps, public.places, public.offers to anon, authenticated;
create policy guides_read on public.guides for select to anon, authenticated using (status = 'published');
create policy guide_steps_read on public.guide_steps for select to anon, authenticated using (
  exists (select 1 from public.guides g where g.id = guide_id and g.status = 'published'));
create policy places_read on public.places for select to anon, authenticated using (status = 'published');
create policy offers_read on public.offers for select to anon, authenticated using (status = 'published');

-- Guide progress: the family's own.
grant select, delete on public.guide_progress to authenticated;
grant insert (family_id, child_id, step_id) on public.guide_progress to authenticated;
create policy guide_progress_select on public.guide_progress for select to authenticated
  using (family_id = (select public.my_family_id()));
create policy guide_progress_insert on public.guide_progress for insert to authenticated
  with check (family_id = (select public.my_family_id()));
create policy guide_progress_delete on public.guide_progress for delete to authenticated
  using (family_id = (select public.my_family_id()));

create trigger guides_touch before update on public.guides for each row execute function public.touch_updated_at();
create trigger places_touch before update on public.places for each row execute function public.touch_updated_at();
create trigger offers_touch before update on public.offers for each row execute function public.touch_updated_at();
