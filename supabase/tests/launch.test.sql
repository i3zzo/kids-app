-- Launch checks: every table is protected, the tips shortcut only sees my
-- children, and the 6 pm supplies job does its work once a day.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

select is(
  (select coalesce(string_agg(c.relname, ', '), '') from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
  '', 'every table in the public schema has Row Level Security switched on');

insert into auth.users (id, phone, aud, role) values
  ('b1000000-0000-0000-0000-000000000001', '96599992001', 'authenticated', 'authenticated'),
  ('b1000000-0000-0000-0000-000000000002', '96599992002', 'authenticated', 'authenticated');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b1000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select public.create_family('Other', 'privacy-2026-11-draft');
insert into public.children (family_id, first_name, birth_date, gender) values (public.my_family_id(), 'Other kid', current_date - 100, 'boy');

select set_config('request.jwt.claims', '{"sub":"b1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select public.create_family('Mine', 'privacy-2026-11-draft');
insert into public.children (family_id, first_name, birth_date, gender) values (public.my_family_id(), 'Mine', current_date - interval '7 months' - interval '2 days', 'girl');
select is((select count(distinct child_id)::int from public.my_children_tips()), 1, 'the tips shortcut only returns my own child');
select is((select count(*)::int from public.my_children_tips()), 5, 'a 7-month-old gets one tip per section');

reset role;
-- Pretend it is 18:30 in Kuwait for the supplies job.
create or replace function public.kuwait_now() returns timestamp language sql stable as $$ select current_date + time '18:30' $$;
-- The real cron job may already have run today on this database.
delete from public.job_runs where job = 'supply_low';
insert into public.device_tokens (token, user_id, platform) values ('ExponentPushToken[launchtest]', 'b1000000-0000-0000-0000-000000000001', 'ios');
insert into public.supply_items (family_id, child_id, category, name, quantity, low_threshold)
select family_id, id, 'diapering', 'Diapers', 0, 1 from public.children where first_name = 'Mine';
select ok(public.queue_supply_reminders() >= 1, 'the first 6 pm run sends "running low" reminders');
select is(public.queue_supply_reminders(), 0, 'later runs the same evening do nothing');

select * from finish();
rollback;
