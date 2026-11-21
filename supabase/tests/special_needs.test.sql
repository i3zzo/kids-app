-- Special needs: the support profile is private to the family, shows in the
-- export, goes when the child goes, and only changes which content is shown.
begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

insert into auth.users (id, phone, aud, role) values
  ('a2000000-0000-0000-0000-000000000001', '96599992001', 'authenticated', 'authenticated'),  -- owner
  ('a2000000-0000-0000-0000-000000000002', '96599992002', 'authenticated', 'authenticated'),  -- co-parent
  ('a2000000-0000-0000-0000-000000000003', '96599992003', 'authenticated', 'authenticated');  -- other family

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a2000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select public.create_family('Noor', 'privacy-2026-11-draft');
insert into public.children (family_id, first_name, birth_date, gender) values
  (public.my_family_id(), 'Sara', current_date - 1200, 'girl'),
  (public.my_family_id(), 'Omar', current_date - 1300, 'boy');
create temp table kid on commit drop as select first_name, id, family_id from public.children;
grant select on kid to authenticated;
select lives_ok($$ insert into public.child_support (child_id, family_id, needs, notes, has_pada_card)
  values ((select id from kid where first_name = 'Sara'), public.my_family_id(), '{autism,speech}', 'Loves trains', true) $$,
  'a parent can save their child''s support profile');
select throws_ok($$ insert into public.child_support (child_id, family_id, needs)
  values ((select id from kid where first_name = 'Omar'), public.my_family_id(), '{made_up}') $$, '23514', null, 'only known needs are accepted');
select throws_ok($$ insert into public.child_support (child_id, family_id, notes)
  values ((select id from kid where first_name = 'Omar'), public.my_family_id(), repeat('x', 301)) $$, '23514', null, 'notes are limited to 300 characters');
select throws_ok($$ update public.child_support set family_id = gen_random_uuid() $$, '42501', null, 'the family of a support row can''t be changed');
select lives_ok($$ insert into public.events (family_id, child_id, kind, title, starts_at)
  values (public.my_family_id(), (select id from kid where first_name = 'Sara'), 'therapy', 'Speech therapy', now() + interval '1 day') $$,
  'calendar events can be therapy sessions');
create temp table code on commit drop as select public.create_family_invite() as c;
grant select on code to authenticated;

select lives_ok($$ select public.save_child_support((select id from kid where first_name = 'Omar'), '{hearing}', '  ', false) $$,
  'the save function creates a profile');
select is((select notes from public.child_support where child_id = (select id from kid where first_name = 'Omar')), null, '... and stores a blank note as empty');
select public.save_child_support((select id from kid where first_name = 'Omar'), '{}', null, null);
select is((select count(*)::int from public.child_support where child_id = (select id from kid where first_name = 'Omar')), 0,
  'saving an empty profile removes it');

-- Co-parent sees it
select set_config('request.jwt.claims', '{"sub":"a2000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select public.accept_family_invite((select c from code));
select is((select needs from public.child_support), '{autism,speech}'::text[], 'the other parent sees the support profile');

-- Another family can't see or attach anything
select set_config('request.jwt.claims', '{"sub":"a2000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
select public.create_family('Other', 'privacy-2026-11-draft');
select is((select count(*)::int from public.child_support), 0, 'another family sees no support profiles');
select throws_ok($$ insert into public.child_support (child_id, family_id, needs)
  values ((select id from kid where first_name = 'Omar'), public.my_family_id(), '{adhd}') $$, '23503', null,
  'another family can''t attach a profile to someone else''s child');
select throws_ok($$ insert into public.child_support (child_id, family_id, needs)
  values ((select id from kid where first_name = 'Omar'), (select family_id from kid limit 1), '{adhd}') $$, '42501', null,
  '... even by naming that family');
select throws_ok($$ select public.save_child_support((select id from kid where first_name = 'Omar'), '{adhd}', null, null) $$, 'P0002', null,
  '... or through the save function');
select is((select count(*)::int from (select public.export_my_data() -> 'child_support' as j) x where jsonb_array_length(j) > 0), 0,
  'another family''s export has no support profiles');
reset role;
set local role anon;
select throws_ok($$ select * from public.child_support $$, '42501', null, 'signed-out visitors can''t read support profiles');
reset role;

-- Tips and export, as the owner
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a2000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select ok(exists(select 1 from public.my_children_tips() where child_id = (select id from kid where first_name = 'Sara') and title_en = 'A picture schedule'),
  'a child with autism gets the autism tips');
select ok(not exists(select 1 from public.my_children_tips() where child_id = (select id from kid where first_name = 'Sara') and title_en = 'Face your child'),
  '... but not tips for needs they don''t have');
select ok(not exists(select 1 from public.my_children_tips() t join public.tips x on x.id = t.id
  where t.child_id = (select id from kid where first_name = 'Omar') and x.for_needs <> '{}'),
  'a child without needs gets only general tips');
select is((select public.export_my_data() -> 'child_support' -> 0 ->> 'notes'), 'Loves trains', 'the export includes the support profile');
select lives_ok($$ delete from public.children where id = (select id from kid where first_name = 'Sara') $$, 'deleting the child works');
reset role;
select is((select count(*)::int from public.child_support), 0, '... and deletes the support profile with it');

-- Content
select is((select count(*)::int from public.guides where topic = 'disability' and status = 'published'), 3, 'three disability guides are published');

select * from finish();
rollback;
