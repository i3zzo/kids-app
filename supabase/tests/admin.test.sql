-- Admin: roles are enforced by the database, health content needs a health
-- reviewer, every change is audited, staff never see family data.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, phone, aud, role) values
  ('bbbbbbbb-0000-0000-0000-000000000001', '96599990021', 'authenticated', 'authenticated'), -- super admin
  ('bbbbbbbb-0000-0000-0000-000000000002', '96599990022', 'authenticated', 'authenticated'), -- editor
  ('bbbbbbbb-0000-0000-0000-000000000003', '96599990023', 'authenticated', 'authenticated'), -- health reviewer
  ('bbbbbbbb-0000-0000-0000-000000000004', '96599990024', 'authenticated', 'authenticated'); -- parent
insert into public.staff (user_id, role, display_name) values ('bbbbbbbb-0000-0000-0000-000000000001', 'super_admin', 'Boss');

create or replace function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  select set_config('role', 'authenticated', true);
$$;

-- a parent family with a child, to prove staff can't see it
select pg_temp.login('bbbbbbbb-0000-0000-0000-000000000004');
select public.create_family('Parent', 'privacy-2026-11-draft');
insert into public.children (family_id, first_name, birth_date, gender) values (public.my_family_id(), 'Kid', current_date - 100, 'boy');
select throws_ok($$ select public.add_staff('96599990024', 'super_admin', 'Me') $$, '42501', null, 'a parent cannot make themselves staff');
select throws_ok($$ insert into public.places (category, name_ar, name_en, governorate) values ('hospital', 'x', 'x', 'capital') $$,
  '42501', null, 'a parent cannot add directory places');

select pg_temp.login('bbbbbbbb-0000-0000-0000-000000000001');
select lives_ok($$ select public.add_staff('+96599990022', 'editor', 'Ed') $$, 'super admin adds an editor by phone');
select lives_ok($$ select public.add_staff('96599990023', 'health_reviewer', 'Dr Huda') $$, 'super admin adds a health reviewer');
select is((select count(*)::int from public.children), 0, 'staff cannot see family data');
select throws_ok($$ update public.staff set role = 'editor' where user_id = auth.uid() $$, '42501', null,
  'a super admin cannot demote themselves by mistake (no lock-out)');

-- editor
select pg_temp.login('bbbbbbbb-0000-0000-0000-000000000002');
select lives_ok($$ insert into public.places (category, name_ar, name_en, governorate, status) values ('nursery', 'حضانة', 'Nursery A', 'hawalli', 'published') $$,
  'an editor publishes a directory place');
select is((select reviewed_by from public.places where name_en = 'Nursery A'), 'bbbbbbbb-0000-0000-0000-000000000002'::uuid,
  'the database records who published it');
select throws_ok($$ insert into public.supply_suggestions (category, name_ar, name_en, min_age_months, max_age_months, status) values ('health', 'x', 'x', 0, 12, 'published') $$,
  '42501', null, 'an editor cannot publish health content');
update public.supply_suggestions set hint_en = hint_en || ' (edited)' where name_en = 'Thermometer';
select is((select status from public.supply_suggestions where name_en = 'Thermometer'), 'in_review',
  'an editor''s change to published health content goes back to review');
select throws_ok($$ select public.add_staff('96599990024', 'editor', 'x') $$, '42501', null, 'an editor cannot add staff');
select is((select count(*)::int from public.audit_log), 0, 'an editor cannot read the audit log');

-- health reviewer
select pg_temp.login('bbbbbbbb-0000-0000-0000-000000000003');
select lives_ok($$ update public.supply_suggestions set status = 'published' where name_en = 'Thermometer' $$, 'a health reviewer publishes it again');
select lives_ok($$ select public.mark_schedule_reviewed((select id from public.vaccine_schedule_versions limit 1)) $$,
  'a health reviewer marks the vaccine schedule as checked');

-- audit
select pg_temp.login('bbbbbbbb-0000-0000-0000-000000000001');
select ok((select count(*) from public.audit_log where table_name = 'places' and action = 'INSERT' and actor = 'bbbbbbbb-0000-0000-0000-000000000002') = 1, 'the audit log records the new place');
select throws_ok($$ delete from public.audit_log $$, '42501', null, 'nobody can delete the audit log');

select * from finish();
rollback;
