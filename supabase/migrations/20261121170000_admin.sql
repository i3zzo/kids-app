-- =============================================================================
-- Step 6: admin panel — staff roles, review before publishing, audit log
-- =============================================================================
-- Plain-language summary
--   * Our team signs in to the admin panel with their phone, like parents.
--     What they can do depends on their role, and the DATABASE checks it:
--       editor           write drafts; publish directory, offers, guides, brands
--       health_reviewer  everything an editor can, plus publish health content
--                        (suggested supplies, later the tips library) and add
--                        review notes to the vaccination schedule
--       super_admin      manage staff, read the audit log, publish non-health
--                        content (not health content, per the PRD)
--   * Content moves draft -> in review -> published. The database records who
--     published it and when. If an editor changes published health content,
--     it goes back to "in review" automatically.
--   * Every change to content or staff is written to an audit log that
--     nobody can edit.
--   * Staff never see family data: none of these rules give access to it.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Staff and roles
-- -----------------------------------------------------------------------------
create table public.staff (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  role         text not null check (role in ('editor', 'health_reviewer', 'super_admin')),
  display_name text not null check (char_length(display_name) between 1 and 60 and display_name !~ '[\u0000-\u001F‪-‮⁦-⁩]'),
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

-- The signed-in user's staff role, or null for parents and visitors.
create or replace function public.staff_role()
returns text
language sql stable security definer set search_path = ''
as $$
  select role from public.staff where user_id = auth.uid() and active
$$;
revoke execute on function public.staff_role() from public, anon;
grant execute on function public.staff_role() to authenticated;

alter table public.staff enable row level security;
revoke all on public.staff from anon, authenticated;
grant select on public.staff to authenticated;
grant update (role, display_name, active) on public.staff to authenticated;
create policy staff_read on public.staff for select to authenticated
  using (user_id = (select auth.uid()) or (select public.staff_role()) = 'super_admin');
create policy staff_update on public.staff for update to authenticated
  using ((select public.staff_role()) = 'super_admin')
  with check ((select public.staff_role()) = 'super_admin' and user_id <> (select auth.uid()));

-- Add a team member by phone. They must have signed in once (so they have an
-- account). Only a super admin can do this.
create or replace function public.add_staff(staff_phone text, new_role text, name text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid;
begin
  if public.staff_role() is distinct from 'super_admin' then
    raise exception 'only a super admin can add staff' using errcode = '42501';
  end if;
  select id into uid from auth.users where phone = regexp_replace(staff_phone, '^\+', '');
  if uid is null then
    raise exception 'no account with this phone: ask them to sign in once first' using errcode = 'P0002';
  end if;
  insert into public.staff (user_id, role, display_name) values (uid, new_role, name)
  on conflict (user_id) do update set role = excluded.role, display_name = excluded.display_name, active = true;
  return uid;
end;
$$;
revoke execute on function public.add_staff(text, text, text) from public, anon;
grant execute on function public.add_staff(text, text, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Review workflow on content tables
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['brands', 'supply_suggestions', 'guides', 'places', 'offers'] loop
    execute format('alter table public.%I drop constraint %I', t, t || '_status_check');
    execute format($f$alter table public.%I add constraint %I check (status in ('draft', 'in_review', 'published'))$f$, t, t || '_status_check');
    execute format('alter table public.%I add column reviewed_by uuid references auth.users (id) on delete set null, add column reviewed_at timestamptz', t);
  end loop;
end $$;

-- Publishing rules. TG_ARGV[0] is 'health' or 'general'.
create or replace function public.content_review_guard()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  r text := public.staff_role();
  kind text := tg_argv[0];
  may_publish boolean;
begin
  -- Migrations and the database owner (no signed-in user) are not limited.
  if auth.uid() is null then
    return new;
  end if;
  if r is null then
    raise exception 'staff only' using errcode = '42501';
  end if;
  may_publish := case kind
    when 'health' then r = 'health_reviewer'
    else r in ('editor', 'health_reviewer', 'super_admin')
  end;

  if new.status = 'published' and (tg_op = 'INSERT' or old.status <> 'published') then
    if not may_publish then
      raise exception 'only a health reviewer can publish health content' using errcode = '42501';
    end if;
    new.reviewed_by := auth.uid();
    new.reviewed_at := now();
  elsif tg_op = 'UPDATE' and old.status = 'published' and new.status = 'published' and not may_publish then
    -- Someone who may not publish this changed it: it needs review again.
    new.status := 'in_review';
    new.reviewed_by := null;
    new.reviewed_at := null;
  elsif new.status <> 'published' then
    new.reviewed_by := null;
    new.reviewed_at := null;
  end if;
  return new;
end;
$$;
revoke execute on function public.content_review_guard() from public, anon, authenticated;

create trigger supply_suggestions_review before insert or update on public.supply_suggestions
  for each row execute function public.content_review_guard('health');
create trigger brands_review before insert or update on public.brands
  for each row execute function public.content_review_guard('general');
create trigger guides_review before insert or update on public.guides
  for each row execute function public.content_review_guard('general');
create trigger places_review before insert or update on public.places
  for each row execute function public.content_review_guard('general');
create trigger offers_review before insert or update on public.offers
  for each row execute function public.content_review_guard('general');

-- Staff can read every row (drafts too) and write content tables.
do $$
declare t text;
begin
  foreach t in array array['brands', 'supply_suggestions', 'guides', 'guide_steps', 'places', 'offers'] loop
    execute format('grant insert, update, delete on public.%I to authenticated', t);
    execute format('create policy %I on public.%I for select to authenticated using ((select public.staff_role()) is not null)', t || '_staff_read', t);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select public.staff_role()) is not null)', t || '_staff_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using ((select public.staff_role()) is not null) with check ((select public.staff_role()) is not null)', t || '_staff_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using ((select public.staff_role()) is not null)', t || '_staff_delete', t);
  end loop;
end $$;
-- The reviewer columns are set by the database only.
revoke update (reviewed_by, reviewed_at) on public.brands, public.supply_suggestions, public.guides, public.places, public.offers from authenticated;

-- Vaccination schedule: health reviewers add review notes and mark it checked.
alter table public.vaccine_schedule_versions
  add column reviewed_by uuid references auth.users (id) on delete set null,
  add column reviewed_at timestamptz;
grant update (review_note_ar, review_note_en) on public.vaccine_schedule_versions to authenticated;
create policy vaccine_versions_review on public.vaccine_schedule_versions for update to authenticated
  using ((select public.staff_role()) = 'health_reviewer')
  with check ((select public.staff_role()) = 'health_reviewer');

-- Health reviewer marks the schedule as checked (records who and when).
create or replace function public.mark_schedule_reviewed(version uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if public.staff_role() is distinct from 'health_reviewer' then
    raise exception 'only a health reviewer can do this' using errcode = '42501';
  end if;
  update public.vaccine_schedule_versions set reviewed_by = auth.uid(), reviewed_at = now() where id = version;
end;
$$;
revoke execute on function public.mark_schedule_reviewed(uuid) from public, anon;
grant execute on function public.mark_schedule_reviewed(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 3. Audit log
-- -----------------------------------------------------------------------------
create table public.audit_log (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  actor       uuid,
  actor_role  text,
  table_name  text not null,
  row_id      text,
  action      text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  before      jsonb,
  after       jsonb
);
create index audit_log_at_idx on public.audit_log (at desc);
alter table public.audit_log enable row level security;
revoke all on public.audit_log from anon, authenticated;
grant select on public.audit_log to authenticated;
create policy audit_log_read on public.audit_log for select to authenticated
  using ((select public.staff_role()) = 'super_admin');

create or replace function public.audit_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  key text := tg_argv[0];
begin
  insert into public.audit_log (actor, actor_role, table_name, row_id, action, before, after)
  values (
    auth.uid(),
    public.staff_role(),
    tg_table_name,
    coalesce(to_jsonb(new) ->> key, to_jsonb(old) ->> key),
    tg_op,
    case when tg_op <> 'INSERT' then to_jsonb(old) end,
    case when tg_op <> 'DELETE' then to_jsonb(new) end
  );
  return null;
end;
$$;
revoke execute on function public.audit_change() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['brands', 'supply_suggestions', 'guides', 'guide_steps', 'places', 'offers', 'vaccine_schedule_versions'] loop
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.audit_change(%L)', t || '_audit', t, 'id');
  end loop;
end $$;
create trigger staff_audit after insert or update or delete on public.staff
  for each row execute function public.audit_change('user_id');
