-- Tips: published library is public, only a health reviewer publishes, AI use is limited.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

set local role anon;
select is((select count(*)::int from public.tips where for_needs = '{}'), 40, 'visitors can read the 40 published general tips');
select is((select count(*)::int from public.tips where for_needs = '{}' and 7 between min_age_months and max_age_months), 5,
  'a 7-month-old has one tip for each of the 5 sections');
reset role;

insert into auth.users (id, phone, aud, role) values
  ('cccccccc-0000-0000-0000-000000000001', '96599990031', 'authenticated', 'authenticated'),
  ('cccccccc-0000-0000-0000-000000000002', '96599990032', 'authenticated', 'authenticated');
insert into public.staff (user_id, role, display_name) values ('cccccccc-0000-0000-0000-000000000001', 'editor', 'Ed');

select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$ insert into public.tips (section, min_age_months, max_age_months, title_ar, title_en, body_ar, body_en, status)
  values ('sleep', 0, 2, 'x', 'x', 'x', 'x', 'published') $$, '42501', null, 'an editor cannot publish a tip (health content)');

select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000002","role":"authenticated"}', true);
select throws_ok($$ insert into public.tips (section, min_age_months, max_age_months, title_ar, title_en, body_ar, body_en)
  values ('sleep', 0, 2, 'x', 'x', 'x', 'x') $$, '42501', null, 'a parent cannot write tips');
select ok((select bool_and(public.claim_ai_request()) from generate_series(1, 20)), 'a parent can use AI personalisation 20 times a day');
select is(public.claim_ai_request(), false, 'the 21st request in a day is refused');

select * from finish();
rollback;
