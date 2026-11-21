-- Security tests: prove the database blocks one family from touching another.
-- Run with:  npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(33);

-- Three parents: Amal (family A owner), Badr (will join A), Sara (family S).
insert into auth.users (id, phone, aud, role) values
  ('11111111-1111-1111-1111-111111111111', '96599990001', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', '96599990002', 'authenticated', 'authenticated'),
  ('33333333-3333-3333-3333-333333333333', '96599990003', 'authenticated', 'authenticated');

select ok((select count(*) from public.profiles where id in ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333')) = 3, 'a profile is created for each new user');

-- helper: act as a signed-in user
create or replace function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  select set_config('role', 'authenticated', true);
$$;
create or replace function pg_temp.logout() returns void language sql as $$
  select set_config('request.jwt.claims', '', true);
  select set_config('role', 'anon', true);
$$;

-- ---------------------------------------------------------------- Amal
select pg_temp.login('11111111-1111-1111-1111-111111111111');

select throws_ok($$ select public.create_family('Al-Amal', '') $$, '22023', null,
  'a family cannot be created without accepting the privacy notice');
select lives_ok($$ select public.create_family('Al-Amal', 'privacy-2026-11') $$, 'Amal creates a family');
select throws_ok($$ select public.create_family('Second', 'privacy-2026-11') $$, '23505', null,
  'a parent can only belong to one family');
select throws_ok($$ insert into public.families (name, created_by, privacy_version)
  values ('x', '11111111-1111-1111-1111-111111111111', 'v') $$, '42501', null,
  'families cannot be inserted directly (only through create_family)');

insert into public.children (family_id, first_name, birth_date, gender)
values (public.my_family_id(), 'Noor', current_date - 70, 'girl');

select ok((select count(*) from public.child_vaccinations) > 20,
  'adding a child generates the MOH vaccination schedule');
select is((select count(*)::int from public.child_vaccinations cv join public.vaccine_doses d on d.id = cv.dose_id
           where d.only_gender = 'girl'), 1, 'girl-only doses are included for a girl');
select is((select due_date from public.child_vaccinations cv join public.vaccine_doses d on d.id = cv.dose_id
           where d.vaccine_code = 'BCG'), (current_date - 70 + interval '3 months')::date,
  'BCG is due at the end of the 3rd month');

select throws_ok($$ insert into public.children (family_id, first_name, birth_date, gender)
  values (public.my_family_id(), 'Future', current_date + 3, 'boy') $$, '22023', null,
  'birth date cannot be in the future');
select throws_ok($$ insert into public.children (family_id, first_name, birth_date, gender)
  values (public.my_family_id(), 'Old', current_date - interval '12 years', 'boy') $$, '22023', null,
  'children older than 10 are rejected');

insert into public.events (family_id, child_id, title, starts_at)
select public.my_family_id(), id, 'Swimming', now() + interval '1 day' from public.children;
select is((select created_by from public.events), '11111111-1111-1111-1111-111111111111'::uuid,
  'created_by is filled in by the database');

select throws_ok($$ update public.child_vaccinations set child_id = gen_random_uuid() $$, '42501', null,
  'parents cannot move a vaccination record to another child');

create temp table invite on commit drop as select public.create_family_invite() as code;
grant select on invite to authenticated, anon;
create temp table amal on commit drop as
  select (select public.my_family_id()) as family_id, (select id from public.children limit 1) as child_id;
grant select on amal to authenticated, anon;
select is(length((select code from invite)), 8, 'owner gets an 8-character invite code');

-- ---------------------------------------------------------------- Sara (other family)
select pg_temp.login('33333333-3333-3333-3333-333333333333');
select public.create_family('Al-Sara', 'privacy-2026-11');

select is((select count(*)::int from public.children), 0, 'Sara cannot see Amal''s children');
select is((select count(*)::int from public.events), 0, 'Sara cannot see Amal''s events');
select is((select count(*)::int from public.child_vaccinations), 0, 'Sara cannot see Amal''s vaccinations');
select is((select count(*)::int from public.families), 1, 'Sara sees only her own family');
select is((select count(*)::int from public.family_invites), 0, 'Sara cannot see Amal''s invite codes');
select is((select count(*)::int from public.profiles), 1, 'Sara sees only her own profile');

select throws_ok($$ insert into public.children (family_id, first_name, birth_date, gender)
  select family_id, 'Intruder', current_date - 10, 'boy' from amal $$, '42501', null,
  'Sara cannot add a child to Amal''s family, even with its id');

-- Sara tries to attach an event to Amal's child, inside her own family:
-- the (child_id, family_id) foreign key blocks it.
select throws_ok($$ insert into public.events (family_id, child_id, title, starts_at)
  values (public.my_family_id(),
    (select child_id from amal), 'x', now()) $$, '23503', null,
  'Sara cannot attach an event to Amal''s child, even with its id');
select throws_ok($$ insert into public.events (family_id, child_id, title, starts_at)
  select family_id, child_id, 'x', now() from amal $$, '42501', null,
  'Sara cannot add events to Amal''s calendar');

update public.children set first_name = 'Hacked';
delete from public.events;
delete from public.children;
select lives_ok($$ select public.create_family_invite() $$, 'Sara''s own family still works (she can invite to it)');

-- ---------------------------------------------------------------- Badr joins Amal
select pg_temp.login('22222222-2222-2222-2222-222222222222');
select throws_ok($$ select public.accept_family_invite('WRONG123') $$, '22023', null,
  'a wrong invite code is rejected');
select lives_ok(format('select public.accept_family_invite(%L)', (select lower(code) from invite)),
  'Badr joins with the code (case-insensitive)');
select is((select first_name from public.children), 'Noor',
  'Badr now sees the family''s child, and Sara''s update/delete did nothing');
select is((select count(*)::int from public.events), 1, 'Sara''s delete did not remove Amal''s event');
select lives_ok($$ update public.child_vaccinations set status = 'done', done_on = current_date
  where due_date <= current_date $$, 'co-parent can mark doses done');
select throws_ok($$ select public.create_family_invite() $$, '42501', null,
  'a co-parent cannot create invites');
select is((select count(*)::int from public.family_members where role = 'owner' and user_id <> '22222222-2222-2222-2222-222222222222'), 1,
  'Badr sees his co-parent');

-- ---------------------------------------------------------------- invite reuse
select pg_temp.login('33333333-3333-3333-3333-333333333333');
select throws_ok(format('select public.accept_family_invite(%L)', (select code from invite)), '23505', null,
  'someone already in a family cannot use an invite');

-- ---------------------------------------------------------------- anonymous visitor
select pg_temp.logout();
select throws_ok($$ select count(*) from public.children $$, '42501', null, 'visitors cannot read children at all');
select ok((select count(*) from public.vaccine_doses) > 20, 'visitors can read the public MOH schedule');

select * from finish();
rollback;
