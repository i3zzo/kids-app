-- =============================================================================
-- Directory: prices, addresses and where each listing came from
-- =============================================================================
-- The researched listings (20261121210100_directory_listings.sql) record a
-- price only when a public source shows one, and always record the source and
-- the date it was checked. verified_on stays null until the team has called
-- or visited, so the app keeps showing "details not yet confirmed".

-- New section: medical centres (government primary health care clinics,
-- specialised centres and private polyclinics).
alter table public.places drop constraint places_category_check;
alter table public.places add constraint places_category_check
  check (category in ('activity', 'nursery', 'school', 'hospital', 'medical_centre', 'paediatrician', 'toy_store', 'clothing_store'));

alter table public.places
  -- Stable key for a listing, so a re-import updates the row instead of adding a copy.
  add column ref               text unique check (ref ~ '^[a-z0-9-]{3,80}$'),
  add column address           text check (char_length(address) <= 200),
  -- Price in Kuwaiti dinars. Null min and max = the price isn't published.
  add column price_min_kwd     numeric(9,3) check (price_min_kwd >= 0),
  add column price_max_kwd     numeric(9,3) check (price_max_kwd >= 0),
  -- null with a price = the source doesn't say what period it covers
  add column price_unit        text check (price_unit in ('visit', 'entry', 'hour', 'month', 'year')),
  add column price_note_ar     text check (char_length(price_note_ar) <= 200),
  add column price_note_en     text check (char_length(price_note_en) <= 200),
  add column source_url        text check (source_url ~ '^https://'),
  add column source_checked_on date,
  add check (price_max_kwd is null or price_min_kwd is not null),
  add check (price_max_kwd is null or price_max_kwd >= price_min_kwd),
  -- A price must say where it came from and when.
  add check (price_min_kwd is null or (source_url is not null and source_checked_on is not null));

-- The directory with "All governorates" selected filters on category only and
-- orders by name: the (category, governorate, name_en, id) index can't give
-- that order without a sort, so this one serves it.
create index places_category_name_idx on public.places (category, name_en, id) where status = 'published';

-- "New and trending": a place is featured until this date, with the reason
-- (for example "opened in October 2026", from a dated news source).
alter table public.places
  add column trending_until    date,
  add column trending_note_ar  text check (char_length(trending_note_ar) <= 200),
  add column trending_note_en  text check (char_length(trending_note_en) <= 200);
create index places_trending_idx on public.places (trending_until, id) where status = 'published' and trending_until is not null;

-- Special needs. A place lists which needs it serves or how it is accessible,
-- from this fixed set (the needs overlap with public.child_support.needs, so a
-- family's own needs can pick the right places):
--   autism, adhd, speech, occupational, physio, hearing, visual, learning,
--   down_syndrome, physical, developmental_delay, early_intervention  (services)
--   intellectual                                                      (directory only)
--   all_needs (the provider says it serves all disabilities)
--   general   (special-needs or inclusive classes, the source doesn't say which needs)
--   wheelchair_access, sensory_friendly                               (access)
-- Two sections for providers that aren't a school, nursery or hospital:
-- therapy_centre (speech, OT, physio, ABA, rehab) and support_service (PADA
-- offices and charities).
alter table public.places drop constraint places_category_check;
alter table public.places add constraint places_category_check
  check (category in ('activity', 'nursery', 'school', 'hospital', 'medical_centre', 'paediatrician',
                      'therapy_centre', 'support_service', 'toy_store', 'clothing_store'));

alter table public.places
  add column special_needs_services   text[] not null default '{}'
    check (special_needs_services <@ array['autism', 'adhd', 'speech', 'occupational', 'physio', 'hearing', 'visual',
      'learning', 'down_syndrome', 'physical', 'developmental_delay', 'early_intervention', 'intellectual', 'all_needs', 'general', 'wheelchair_access', 'sensory_friendly']::text[]),
  add column special_needs_note_ar    text check (char_length(special_needs_note_ar) <= 300),
  add column special_needs_note_en    text check (char_length(special_needs_note_en) <= 300),
  add column special_needs_source_url text check (special_needs_source_url ~ '^https://'),
  -- A special-needs tag must say where it came from (the listing's own source
  -- or a separate one, for example an article saying a park is accessible).
  add check (special_needs_services = '{}' or special_needs_source_url is not null or source_url is not null);

-- No extra index for the special-needs filter. Measured at 20,000 listings with
-- 1 in 10 tagged (supabase/perf/directory.sql): the existing category indexes
-- answer "any need" in 0.05 ms and "autism" in 0.4 ms, and a partial btree or a
-- GIN index on the tags made no difference (the planner didn't pick the GIN
-- one). A tag no place has yet scans one section: 4 to 7 ms.
