-- =============================================================================
-- Yahal · ياهل — Step 1: families, children, calendar and MOH vaccinations
-- =============================================================================
-- Plain-language summary
--   * A parent signs in with Supabase Auth (phone + one-time code). We never
--     store passwords ourselves.
--   * Each parent belongs to ONE family. A family has an owner and can invite
--     one co-parent with a short code.
--   * Children belong to a family. We keep only basic data: first name,
--     birth date, gender and (optional) nationality group. No ID numbers.
--   * When a child is added, the database itself creates that child's Kuwait
--     MOH vaccination schedule.
--   * Every permission rule lives HERE, in Postgres Row Level Security (RLS).
--     The app cannot see or change another family's data even if it has a bug.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- -----------------------------------------------------------------------------
-- 1. Parent profile (one row per signed-in user, created automatically)
-- -----------------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 60),
  locale       text not null default 'ar' check (locale in ('ar', 'en')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 2. Families and members
-- -----------------------------------------------------------------------------
create table public.families (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null check (char_length(btrim(name)) between 1 and 60),
  created_by          uuid not null references auth.users (id) on delete cascade,
  -- Consent record: which privacy notice version the owner accepted, and when.
  privacy_version     text not null,
  privacy_accepted_at timestamptz not null default now(),
  created_at          timestamptz not null default now()
);

create type public.family_role as enum ('owner', 'co_parent');

create table public.family_members (
  family_id uuid not null references public.families (id) on delete cascade,
  user_id   uuid not null references auth.users (id) on delete cascade,
  role      public.family_role not null,
  joined_at timestamptz not null default now(),
  primary key (family_id, user_id),
  -- MVP rule: a parent belongs to exactly one family.
  constraint family_members_one_family_per_user unique (user_id),
  -- Lets the app read a member's display name in the same request.
  constraint family_members_profile_fkey foreign key (user_id) references public.profiles (id) on delete cascade
);

create table public.family_invites (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references public.families (id) on delete cascade,
  code       text not null unique,
  created_by uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null default now() + interval '7 days',
  used_by    uuid references auth.users (id) on delete set null,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);
create index family_invites_family_id_idx on public.family_invites (family_id);

-- -----------------------------------------------------------------------------
-- 3. Children (basic data only — no civil ID / passport numbers, ever)
-- -----------------------------------------------------------------------------
create table public.children (
  id                uuid primary key default gen_random_uuid(),
  family_id         uuid not null references public.families (id) on delete cascade,
  first_name        text not null check (char_length(btrim(first_name)) between 1 and 40),
  birth_date        date not null check (birth_date >= date '2010-01-01'),
  gender            text not null check (gender in ('girl', 'boy')),
  nationality_group text check (nationality_group in ('kuwaiti', 'gcc', 'other')),
  color             text not null default '#0E7C86' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  -- Lets other tables reference (child, family) together, so a row can never
  -- point at a child from a different family.
  constraint children_id_family_key unique (id, family_id)
);
-- Family screen lists children oldest-first: WHERE family_id = ? ORDER BY birth_date, id
create index children_family_birth_idx on public.children (family_id, birth_date, id);

-- -----------------------------------------------------------------------------
-- 4. MOH vaccination schedule (public reference content, versioned)
-- -----------------------------------------------------------------------------
create table public.vaccine_schedule_versions (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique,          -- e.g. 'kw-moh-2019'
  title_ar     text not null,
  title_en     text not null,
  source_url   text,
  review_note_ar text,                        -- shown to parents with the schedule
  review_note_en text,
  is_current   boolean not null default false,
  published_at timestamptz,
  created_at   timestamptz not null default now()
);
-- Only one schedule version can be "current" at a time.
create unique index vaccine_schedule_one_current_idx
  on public.vaccine_schedule_versions (is_current) where is_current;

create table public.vaccine_doses (
  id            uuid primary key default gen_random_uuid(),
  version_id    uuid not null references public.vaccine_schedule_versions (id) on delete cascade,
  vaccine_code  text not null,               -- e.g. 'MMR'
  name_ar       text not null,
  name_en       text not null,
  dose_label_ar text not null,
  dose_label_en text not null,
  age_months    numeric(5, 1) not null check (age_months >= 0),
  -- null = every child; 'girl' = only girls (e.g. MMR booster at school age)
  only_gender   text check (only_gender in ('girl', 'boy')),
  sort_order    int not null default 0
);
create index vaccine_doses_version_idx on public.vaccine_doses (version_id, age_months, sort_order);

-- One row per child per dose: the child's personal vaccination record.
create table public.child_vaccinations (
  id         uuid primary key default gen_random_uuid(),
  child_id   uuid not null,
  family_id  uuid not null,
  dose_id    uuid not null references public.vaccine_doses (id) on delete restrict,
  due_date   date not null,                  -- generated from birth date; parents can reschedule
  status     text not null default 'due' check (status in ('due', 'done', 'skipped')),
  done_on    date,
  clinic     text check (char_length(clinic) <= 80),
  updated_at timestamptz not null default now(),
  foreign key (child_id, family_id) references public.children (id, family_id) on delete cascade,
  unique (child_id, dose_id),
  check (status <> 'done' or done_on is not null)
);
-- Calendar month view: WHERE family_id = ? AND due_date BETWEEN ? AND ? ORDER BY due_date
create index child_vaccinations_family_due_idx on public.child_vaccinations (family_id, due_date, id);
-- Child schedule screen: WHERE child_id = ? ORDER BY due_date
create index child_vaccinations_child_due_idx on public.child_vaccinations (child_id, due_date);

-- -----------------------------------------------------------------------------
-- 5. Calendar events (training, classes, appointments, anything)
-- -----------------------------------------------------------------------------
create table public.events (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references public.families (id) on delete cascade,
  child_id    uuid,                          -- null = whole family
  kind        text not null default 'activity'
              check (kind in ('activity', 'training', 'class', 'appointment', 'other')),
  title       text not null check (char_length(btrim(title)) between 1 and 80),
  starts_at   timestamptz not null,
  ends_at     timestamptz,
  all_day     boolean not null default false,
  location    text check (char_length(location) <= 120),
  notes       text check (char_length(notes) <= 1000),
  created_by  uuid default auth.uid() references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  foreign key (child_id, family_id) references public.children (id, family_id) on delete cascade,
  check (ends_at is null or ends_at >= starts_at)
);
-- Calendar month view: WHERE family_id = ? AND starts_at >= ? AND starts_at < ? ORDER BY starts_at, id
create index events_family_starts_idx on public.events (family_id, starts_at, id);
-- Supports the (child_id, family_id) foreign key's cascade on child delete.
create index events_child_idx on public.events (child_id) where child_id is not null;

-- =============================================================================
-- Helper functions used by the security rules
-- =============================================================================
-- SECURITY DEFINER lets these read family_members without triggering RLS
-- recursion. They only ever answer about the CURRENT user (auth.uid()).
-- Policies compare `family_id = (select my_family_id())`: Postgres works that
-- out once per query (not once per row) and can use the family_id indexes.

create or replace function public.my_family_id()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select family_id from public.family_members where user_id = (select auth.uid())
$$;

create or replace function public.is_family_owner(fid uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.family_members
    where family_id = fid and user_id = (select auth.uid()) and role = 'owner'
  )
$$;

-- =============================================================================
-- Triggers
-- =============================================================================

-- Create a profile row automatically when someone signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep updated_at fresh.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger children_touch before update on public.children
  for each row execute function public.touch_updated_at();
create trigger events_touch before update on public.events
  for each row execute function public.touch_updated_at();
create trigger child_vaccinations_touch before update on public.child_vaccinations
  for each row execute function public.touch_updated_at();

-- Children: birth date can't be in the future or more than ~11 years ago
-- (the app covers ages 0–10). CHECK constraints can't use current_date, so
-- this is a trigger.
create or replace function public.validate_child()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.birth_date > current_date then
    raise exception 'birth_date cannot be in the future' using errcode = '22023';
  end if;
  if new.birth_date < (current_date - interval '11 years')::date then
    raise exception 'Yahal covers children up to 10 years old' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger children_validate before insert or update of birth_date on public.children
  for each row execute function public.validate_child();

-- Generate the child's vaccination schedule from the current MOH version.
-- Runs on the server, so every child always gets the right schedule.
create or replace function public.generate_child_vaccinations()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.child_vaccinations (child_id, family_id, dose_id, due_date)
    select new.id, new.family_id, d.id,
           (new.birth_date
             + make_interval(months => floor(d.age_months)::int)
             + make_interval(days => round((d.age_months - floor(d.age_months)) * 30)::int))::date
    from public.vaccine_doses d
    join public.vaccine_schedule_versions v on v.id = d.version_id and v.is_current
    where d.only_gender is null or d.only_gender = new.gender
    on conflict (child_id, dose_id) do nothing;

  elsif tg_op = 'UPDATE' then
    -- Birth date corrected: move every dose that isn't done yet.
    if new.birth_date is distinct from old.birth_date then
      update public.child_vaccinations cv
      set due_date = (new.birth_date
             + make_interval(months => floor(d.age_months)::int)
             + make_interval(days => round((d.age_months - floor(d.age_months)) * 30)::int))::date
      from public.vaccine_doses d
      where cv.dose_id = d.id and cv.child_id = new.id and cv.status = 'due';
    end if;
    -- Gender corrected: add doses that now apply, drop not-yet-done ones that don't.
    if new.gender is distinct from old.gender then
      delete from public.child_vaccinations cv
      using public.vaccine_doses d
      where cv.dose_id = d.id and cv.child_id = new.id and cv.status = 'due'
        and d.only_gender is not null and d.only_gender <> new.gender;
      insert into public.child_vaccinations (child_id, family_id, dose_id, due_date)
      select new.id, new.family_id, d.id,
             (new.birth_date
               + make_interval(months => floor(d.age_months)::int)
               + make_interval(days => round((d.age_months - floor(d.age_months)) * 30)::int))::date
      from public.vaccine_doses d
      join public.vaccine_schedule_versions v on v.id = d.version_id and v.is_current
      where d.only_gender = new.gender
      on conflict (child_id, dose_id) do nothing;
    end if;
  end if;
  return new;
end;
$$;

create trigger children_generate_vaccinations
  after insert or update of birth_date, gender on public.children
  for each row execute function public.generate_child_vaccinations();

-- =============================================================================
-- Server-side actions (RPC). The app calls these; the rules are enforced here.
-- =============================================================================

-- Create a family. The caller becomes its owner. Requires accepting the
-- privacy notice (the version string is stored as the consent record).
create or replace function public.create_family(family_name text, accepted_privacy_version text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  fid uuid;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  if coalesce(btrim(accepted_privacy_version), '') = '' then
    raise exception 'privacy notice must be accepted' using errcode = '22023';
  end if;
  if exists (select 1 from public.family_members where user_id = uid) then
    raise exception 'you already belong to a family' using errcode = '23505';
  end if;

  insert into public.families (name, created_by, privacy_version)
  values (btrim(family_name), uid, accepted_privacy_version)
  returning id into fid;

  insert into public.family_members (family_id, user_id, role)
  values (fid, uid, 'owner');

  return fid;
end;
$$;

-- Owner creates a one-time invite code for the co-parent (valid 7 days).
create or replace function public.create_family_invite()
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  fid uuid;
  new_code text;
  -- No 0/O/1/I so the code is easy to read out loud.
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i int;
begin
  select family_id into fid from public.family_members
  where user_id = uid and role = 'owner';
  if fid is null then
    raise exception 'only the family owner can invite' using errcode = '42501';
  end if;
  if (select count(*) from public.family_members where family_id = fid) >= 2 then
    raise exception 'this family already has two parents' using errcode = '23514';
  end if;

  -- Cancel any older unused codes so only the newest one works.
  delete from public.family_invites where family_id = fid and used_at is null;

  loop
    new_code := '';
    for i in 1..8 loop
      new_code := new_code || substr(alphabet,
        1 + (get_byte(extensions.gen_random_bytes(1), 0) % length(alphabet)), 1);
    end loop;
    begin
      insert into public.family_invites (family_id, code, created_by)
      values (fid, new_code, uid);
      exit;
    exception when unique_violation then
      -- extremely unlikely; try another code
    end;
  end loop;

  return new_code;
end;
$$;

-- Second parent joins a family with the code.
create or replace function public.accept_family_invite(invite_code text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  inv public.family_invites%rowtype;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  if exists (select 1 from public.family_members where user_id = uid) then
    raise exception 'you already belong to a family' using errcode = '23505';
  end if;

  select * into inv from public.family_invites
  where code = upper(btrim(invite_code))
  for update;

  if inv.id is null or inv.used_at is not null or inv.expires_at < now() then
    raise exception 'invite code is not valid' using errcode = '22023';
  end if;
  if (select count(*) from public.family_members where family_id = inv.family_id) >= 2 then
    raise exception 'this family already has two parents' using errcode = '23514';
  end if;

  insert into public.family_members (family_id, user_id, role)
  values (inv.family_id, uid, 'co_parent');

  update public.family_invites set used_by = uid, used_at = now() where id = inv.id;

  return inv.family_id;
end;
$$;

-- Only signed-in users may call the actions; anonymous visitors may not.
revoke execute on function public.create_family(text, text) from public, anon;
revoke execute on function public.create_family_invite() from public, anon;
revoke execute on function public.accept_family_invite(text) from public, anon;
grant execute on function public.create_family(text, text) to authenticated;
grant execute on function public.create_family_invite() to authenticated;
grant execute on function public.accept_family_invite(text) to authenticated;

revoke execute on function public.my_family_id() from public, anon;
revoke execute on function public.is_family_owner(uuid) from public, anon;
grant execute on function public.my_family_id() to authenticated;
grant execute on function public.is_family_owner(uuid) to authenticated;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.generate_child_vaccinations() from public, anon, authenticated;

-- =============================================================================
-- Row Level Security: who can see and change what
-- =============================================================================
alter table public.profiles                  enable row level security;
alter table public.families                  enable row level security;
alter table public.family_members            enable row level security;
alter table public.family_invites            enable row level security;
alter table public.children                  enable row level security;
alter table public.vaccine_schedule_versions enable row level security;
alter table public.vaccine_doses             enable row level security;
alter table public.child_vaccinations        enable row level security;
alter table public.events                    enable row level security;

-- Start from "nothing allowed" for app users, then grant exactly what's needed.
revoke all on public.profiles, public.families, public.family_members, public.family_invites,
  public.children, public.vaccine_schedule_versions, public.vaccine_doses,
  public.child_vaccinations, public.events
  from anon, authenticated;

-- Profiles: you see and edit only your own; you can also see your co-parent's name.
grant select on public.profiles to authenticated;
grant update (display_name, locale) on public.profiles to authenticated;
create policy profiles_select on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1 from public.family_members fm
      where fm.user_id = profiles.id and fm.family_id = (select public.my_family_id())
    )
  );
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Families: members can see; only the owner can rename or delete.
-- (Creating a family goes through create_family().)
grant select, delete on public.families to authenticated;
grant update (name) on public.families to authenticated;
create policy families_select on public.families for select to authenticated
  using (id = (select public.my_family_id()));
create policy families_update on public.families for update to authenticated
  using ((select public.is_family_owner(id))) with check ((select public.is_family_owner(id)));
create policy families_delete on public.families for delete to authenticated
  using ((select public.is_family_owner(id)));

-- Family members: members see each other. The owner can remove the co-parent;
-- a co-parent can leave. Joining goes through accept_family_invite().
grant select, delete on public.family_members to authenticated;
create policy family_members_select on public.family_members for select to authenticated
  using (family_id = (select public.my_family_id()));
create policy family_members_delete on public.family_members for delete to authenticated
  using (
    role <> 'owner' and (
      user_id = (select auth.uid()) or (select public.is_family_owner(family_id))
    )
  );

-- Invites: only the owner sees or cancels them. Created via create_family_invite().
grant select, delete on public.family_invites to authenticated;
create policy family_invites_owner_select on public.family_invites for select to authenticated
  using ((select public.is_family_owner(family_id)));
create policy family_invites_owner_delete on public.family_invites for delete to authenticated
  using ((select public.is_family_owner(family_id)));

-- Children: both parents can add, see, edit and remove their own family's children.
grant select, insert, delete on public.children to authenticated;
grant update (first_name, birth_date, gender, nationality_group, color) on public.children to authenticated;
create policy children_select on public.children for select to authenticated
  using (family_id = (select public.my_family_id()));
create policy children_insert on public.children for insert to authenticated
  with check (family_id = (select public.my_family_id()));
create policy children_update on public.children for update to authenticated
  using (family_id = (select public.my_family_id()))
  with check (family_id = (select public.my_family_id()));
create policy children_delete on public.children for delete to authenticated
  using (family_id = (select public.my_family_id()));

-- Vaccination schedule: public reference content, readable by everyone.
-- Only staff (service role / admin panel, later) can change it.
grant select on public.vaccine_schedule_versions, public.vaccine_doses to anon, authenticated;
create policy vaccine_versions_read on public.vaccine_schedule_versions for select
  to anon, authenticated using (published_at is not null);
create policy vaccine_doses_read on public.vaccine_doses for select
  to anon, authenticated using (
    exists (select 1 from public.vaccine_schedule_versions v
            where v.id = version_id and v.published_at is not null)
  );

-- Child vaccinations: parents see them and can mark done / reschedule.
-- Rows are created and removed only by the database (triggers, cascade).
grant select on public.child_vaccinations to authenticated;
grant update (due_date, status, done_on, clinic) on public.child_vaccinations to authenticated;
create policy child_vaccinations_select on public.child_vaccinations for select to authenticated
  using (family_id = (select public.my_family_id()));
create policy child_vaccinations_update on public.child_vaccinations for update to authenticated
  using (family_id = (select public.my_family_id()))
  with check (family_id = (select public.my_family_id()));

-- Events: both parents manage their family's calendar.
grant select, insert, delete on public.events to authenticated;
grant update (child_id, kind, title, starts_at, ends_at, all_day, location, notes)
  on public.events to authenticated;
create policy events_select on public.events for select to authenticated
  using (family_id = (select public.my_family_id()));
create policy events_insert on public.events for insert to authenticated
  with check (
    family_id = (select public.my_family_id())
    and created_by = (select auth.uid())
  );
create policy events_update on public.events for update to authenticated
  using (family_id = (select public.my_family_id()))
  with check (family_id = (select public.my_family_id()));
create policy events_delete on public.events for delete to authenticated
  using (family_id = (select public.my_family_id()));
