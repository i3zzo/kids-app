-- Privacy: export your own data only, delete your account (and, for the owner, the family).
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, phone, aud, role) values
  ('a1000000-0000-0000-0000-000000000001', '96599991001', 'authenticated', 'authenticated'),  -- owner
  ('a1000000-0000-0000-0000-000000000002', '96599991002', 'authenticated', 'authenticated'),  -- co-parent
  ('a1000000-0000-0000-0000-000000000003', '96599991003', 'authenticated', 'authenticated'),  -- other family
  ('a1000000-0000-0000-0000-000000000004', '96599991004', 'authenticated', 'authenticated');  -- staff

set local role authenticated;
-- Owner: family, a child, an event, a supply item
select set_config('request.jwt.claims', '{"sub":"a1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select public.create_family('Noor', 'privacy-2026-11-draft');
insert into public.children (family_id, first_name, birth_date, gender) values (public.my_family_id(), 'Lulu', current_date - 200, 'girl');
insert into public.events (family_id, kind, title, starts_at) values (public.my_family_id(), 'class', 'Swimming', now() + interval '1 day');
insert into public.supply_items (family_id, child_id, category, name) select public.my_family_id(), id, 'diapering', 'Diapers' from public.children;
create temp table code on commit drop as select public.create_family_invite() as c;
grant select on code to authenticated;

-- Co-parent joins
select set_config('request.jwt.claims', '{"sub":"a1000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select public.accept_family_invite((select c from code));

-- Another family
select set_config('request.jwt.claims', '{"sub":"a1000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
select public.create_family('Other', 'privacy-2026-11-draft');
insert into public.children (family_id, first_name, birth_date, gender) values (public.my_family_id(), 'Secret', current_date - 400, 'boy');

-- Export, as the owner
select set_config('request.jwt.claims', '{"sub":"a1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
create temp table ex on commit drop as select public.export_my_data() as j;
select is((select j -> 'account' ->> 'phone' from ex), '+96599991001', 'export holds my own phone number');
select is((select jsonb_array_length(j -> 'children') from ex), 1, 'export holds my family''s child');
select is((select j -> 'children' -> 0 ->> 'first_name' from ex), 'Lulu', '... and it is my child, not another family''s');
select is((select jsonb_array_length(j -> 'calendar_events') + jsonb_array_length(j -> 'supplies') from ex), 2, 'export holds the calendar and supplies');
select is((select jsonb_array_length(j -> 'parents') from ex), 2, 'export lists both parents');
select ok((select (j::text not like '%96599991002%') from ex), 'export does not reveal the other parent''s phone');
select ok((select (j::text not like '%Secret%') from ex), 'nothing from another family is in the export');
select ok((select jsonb_array_length(j -> 'vaccinations') > 0 from ex), 'export holds the vaccination schedule');

-- Delete needs the confirmation word
select throws_ok($$ select public.delete_my_account('yes') $$, '22023', null, 'deleting needs the confirmation word');

-- Co-parent deletes their account: the family stays
select set_config('request.jwt.claims', '{"sub":"a1000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select lives_ok($$ select public.delete_my_account('DELETE') $$, 'a co-parent can delete their account');
reset role;
select is((select count(*)::int from auth.users where id = 'a1000000-0000-0000-0000-000000000002'), 0, 'the co-parent''s login is gone');
select is((select count(*)::int from public.children where first_name = 'Lulu'), 1, 'the family stays with the owner');

-- Owner deletes: the whole family goes
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select lives_ok($$ select public.delete_my_account('DELETE') $$, 'the owner can delete their account');
reset role;
select is((select count(*)::int from public.children where first_name = 'Lulu')
        + (select count(*)::int from public.events where title = 'Swimming')
        + (select count(*)::int from public.supply_items where name = 'Diapers')
        + (select count(*)::int from public.families where name = 'Noor'), 0,
  'the owner''s family, children, calendar and supplies are all deleted');
select is((select count(*)::int from public.children where first_name = 'Secret'), 1, 'other families are untouched');

-- Staff can't delete themselves here
insert into public.staff (user_id, role, display_name) values ('a1000000-0000-0000-0000-000000000004', 'editor', 'Ed');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a1000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
select throws_ok($$ select public.delete_my_account('DELETE') $$, '42501', null, 'a staff account must be removed by a super admin first');

select * from finish();
rollback;
