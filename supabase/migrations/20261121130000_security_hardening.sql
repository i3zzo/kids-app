-- =============================================================================
-- Security hardening (from the 21 Nov 2026 security review)
-- =============================================================================
-- Plain-language summary
--   * Only Kuwaiti mobile numbers (+965 4/5/6/9 + 7 digits) can create an
--     account. This is checked by the sign-in server itself, so nobody can
--     make us send SMS to other countries ("SMS pumping").
--   * The privacy-notice version must be one we actually published.
--   * Dates must be realistic; names/titles can't contain invisible
--     direction-flipping characters; a family can't flood the database.
--   * Guessing invite codes is limited to 10 wrong tries per hour.
--   * The app can only fill in the columns it is meant to fill in.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Server-side phone check (Supabase Auth "before user created" hook)
-- -----------------------------------------------------------------------------
create or replace function public.hook_before_user_created(event jsonb)
returns jsonb
language plpgsql stable set search_path = ''
as $$
declare
  phone text := coalesce(event -> 'user' ->> 'phone', '');
begin
  -- Phones arrive without the "+": 965XXXXXXXX
  if phone !~ '^\+?965[4569][0-9]{7}$' then
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 400,
      'message', 'Only Kuwaiti mobile numbers can sign up.'));
  end if;
  return '{}'::jsonb;
end;
$$;

grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_before_user_created(jsonb) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. Privacy notice versions: consent must name a real, published version
-- -----------------------------------------------------------------------------
create table public.privacy_versions (
  version      text primary key check (char_length(version) <= 40),
  published_at timestamptz not null default now()
);
alter table public.privacy_versions enable row level security;
revoke all on public.privacy_versions from anon, authenticated;
grant select on public.privacy_versions to anon, authenticated;
create policy privacy_versions_read on public.privacy_versions for select to anon, authenticated using (true);

insert into public.privacy_versions (version) values ('privacy-2026-11-draft');

alter table public.families
  add constraint families_privacy_version_fkey
  foreign key (privacy_version) references public.privacy_versions (version);

-- -----------------------------------------------------------------------------
-- 3. No invisible control or direction-override characters in names/titles
-- -----------------------------------------------------------------------------
-- Blocks U+0000–U+001F (except tab/newline in notes) and the bidi overrides
-- U+202A–U+202E, U+2066–U+2069 that can make text look like something else.
alter table public.profiles add constraint profiles_display_name_clean
  check (display_name !~ '[\u0000-\u001F‪-‮⁦-⁩]');
alter table public.families add constraint families_name_clean
  check (name !~ '[\u0000-\u001F‪-‮⁦-⁩]');
alter table public.children add constraint children_first_name_clean
  check (first_name !~ '[\u0000-\u001F‪-‮⁦-⁩]');
alter table public.events add constraint events_title_clean
  check (title !~ '[\u0000-\u001F‪-‮⁦-⁩]');
alter table public.events add constraint events_location_clean
  check (location !~ '[\u0000-\u001F‪-‮⁦-⁩]');
alter table public.events add constraint events_notes_clean
  check (notes !~ '[\u0000-\u0008\u000B\u000C\u000E-\u001F‪-‮⁦-⁩]');
alter table public.child_vaccinations add constraint child_vaccinations_clinic_clean
  check (clinic !~ '[\u0000-\u001F‪-‮⁦-⁩]');

-- -----------------------------------------------------------------------------
-- 4. Realistic dates
-- -----------------------------------------------------------------------------
create or replace function public.validate_child_vaccination()
returns trigger
language plpgsql set search_path = ''
as $$
declare
  birth date;
begin
  select birth_date into birth from public.children where id = new.child_id;
  if new.due_date < birth or new.due_date > birth + interval '20 years' then
    raise exception 'due date must be between birth and age 20' using errcode = '22023';
  end if;
  if new.done_on is not null and (new.done_on < birth or new.done_on > current_date) then
    raise exception 'date given must be between birth and today' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger child_vaccinations_validate
  before insert or update of due_date, done_on on public.child_vaccinations
  for each row execute function public.validate_child_vaccination();

create or replace function public.validate_event()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.starts_at < now() - interval '5 years' or new.starts_at > now() + interval '5 years' then
    raise exception 'event date must be within 5 years of today' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger events_validate
  before insert or update of starts_at on public.events
  for each row execute function public.validate_event();

-- -----------------------------------------------------------------------------
-- 5. Limits per family (stop one account filling the database)
-- -----------------------------------------------------------------------------
create or replace function public.enforce_family_limits()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_table_name = 'children' then
    if (select count(*) from public.children where family_id = new.family_id) >= 15 then
      raise exception 'a family can have at most 15 children' using errcode = '23514';
    end if;
  elsif tg_table_name = 'events' then
    if (select count(*) from public.events
        where family_id = new.family_id and created_at > now() - interval '1 day') >= 200 then
      raise exception 'too many events added today' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.enforce_family_limits() from public, anon, authenticated;

create trigger children_limit before insert on public.children
  for each row execute function public.enforce_family_limits();
create trigger events_limit before insert on public.events
  for each row execute function public.enforce_family_limits();

-- Supports the "events added today" count.
create index events_family_created_idx on public.events (family_id, created_at);

-- -----------------------------------------------------------------------------
-- 6. The app may only fill in the columns it is meant to
-- -----------------------------------------------------------------------------
revoke insert on public.children from authenticated;
grant insert (family_id, first_name, birth_date, gender, nationality_group, color) on public.children to authenticated;
revoke insert on public.events from authenticated;
grant insert (family_id, child_id, kind, title, starts_at, ends_at, all_day, location, notes) on public.events to authenticated;

-- -----------------------------------------------------------------------------
-- 7. Invite codes: at most 10 wrong guesses per parent per hour
-- -----------------------------------------------------------------------------
create table public.invite_attempts (
  user_id      uuid not null references auth.users (id) on delete cascade,
  attempted_at timestamptz not null default now()
);
create index invite_attempts_user_idx on public.invite_attempts (user_id, attempted_at);
alter table public.invite_attempts enable row level security;
revoke all on public.invite_attempts from anon, authenticated;

-- Same as before, but a wrong code now returns null (instead of an error) so
-- the failed try is recorded, and too many tries are refused.
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
  if (select count(*) from public.invite_attempts
      where user_id = uid and attempted_at > now() - interval '1 hour') >= 10 then
    raise exception 'too many attempts, try again in an hour' using errcode = '54000';
  end if;
  if exists (select 1 from public.family_members where user_id = uid) then
    raise exception 'you already belong to a family' using errcode = '23505';
  end if;

  select * into inv from public.family_invites
  where code = upper(btrim(coalesce(invite_code, '')))
  for update;

  if inv.id is null or inv.used_at is not null or inv.expires_at < now() then
    insert into public.invite_attempts (user_id) values (uid);
    return null;
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
