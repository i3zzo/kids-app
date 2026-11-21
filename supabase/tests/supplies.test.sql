-- Supplies: family privacy, the "low" flag, suggestions by age and gender, reminders.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, phone, aud, role) values
  ('88888888-8888-8888-8888-888888888888', '96599990008', 'authenticated', 'authenticated'),
  ('99999999-9999-9999-9999-999999999999', '96599990009', 'authenticated', 'authenticated');

-- Hind: family with a 4-month-old girl
select set_config('request.jwt.claims', '{"sub":"88888888-8888-8888-8888-888888888888","role":"authenticated"}', true);
set local role authenticated;
select public.create_family('Hind', 'privacy-2026-11-draft');
insert into public.children (family_id, first_name, birth_date, gender)
values (public.my_family_id(), 'Mira', current_date - interval '4 months' - interval '3 days', 'girl');
create temp table hind on commit drop as
  select public.my_family_id() as family_id, (select id from public.children) as child_id;
grant select on hind to authenticated;

select lives_ok($$ insert into public.supply_items (family_id, child_id, category, name, brand, size, quantity, unit, low_threshold)
  select family_id, child_id, 'diapering', 'Diapers', 'Pampers', '3', 1, 'packs', 1 from hind $$, 'a parent adds a supply item');
select is((select is_low from public.supply_items), true, 'quantity at the low level counts as running low');
update public.supply_items set quantity = 4;
select is((select is_low from public.supply_items), false, 'the low flag updates with the quantity');
select throws_ok($$ update public.supply_items set quantity = -1 $$, '23514', null, 'quantity cannot go below zero');
select throws_ok($$ update public.supply_items set family_id = gen_random_uuid() $$, '42501', null, 'an item cannot be moved to another family');
select throws_ok($$ insert into public.supply_items (family_id, child_id, category, name) select family_id, child_id, 'health', E'bad‮name' from hind $$,
  '23514', null, 'direction-flipping characters are refused');
select throws_ok($$ insert into public.brands (kind, name_ar, name_en) values ('diapers', 'x', 'x') $$, '42501', null,
  'parents cannot add brands');

-- Suggestions for a 4-month-old girl: no boys-only items, formula shows its notice
select is((select count(*)::int from public.supply_suggestions where only_gender = 'boy' and 4 between min_age_months and max_age_months
           and (only_gender is null or only_gender = 'girl')), 0, 'no boys-only suggestions for a girl');
select ok((select bool_and(hint_en like '%Breastfeeding is best%') from public.supply_suggestions where is_formula),
  'every formula suggestion carries the breastfeeding/doctor notice');
select ok((select count(*) from public.brands where kind = 'diapers') >= 4, 'diaper brands are listed');

-- Sara-like outsider
select set_config('request.jwt.claims', '{"sub":"99999999-9999-9999-9999-999999999999","role":"authenticated"}', true);
select public.create_family('Other', 'privacy-2026-11-draft');
select is((select count(*)::int from public.supply_items), 0, 'another family cannot see the supplies');
select throws_ok($$ insert into public.supply_items (family_id, child_id, category, name) select family_id, child_id, 'health', 'x' from hind $$,
  '42501', null, 'another family cannot add to them, even with the ids');

-- Reminder: Hind's item runs low; after 18:00 Kuwait time one reminder per child per day
select set_config('request.jwt.claims', '{"sub":"88888888-8888-8888-8888-888888888888","role":"authenticated"}', true);
update public.supply_items set quantity = 0;
select public.register_device('ExponentPushToken[hind1]', 'ios', 'en');
reset role;
select is(public.queue_supply_reminders(),
  case when (now() at time zone 'Asia/Kuwait')::time >= '18:00' then 1 else 0 end,
  'one low-supply reminder per parent per child, after 18:00 Kuwait time');
select is(public.queue_supply_reminders(), 0, 'not sent twice on the same day');

select * from finish();
rollback;
