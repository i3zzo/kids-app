-- Explore: published content is public, drafts are hidden, guide progress is private.
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

-- a draft guide and a draft offer (as the database owner, like the admin panel will)
insert into public.guides (slug, topic, audience, title_ar, title_en, summary_ar, summary_en, status)
values ('draft-guide', 'birth', 'all', 'مسودة', 'Draft', '-', '-', 'draft');
insert into public.offers (category, title_ar, title_en, store_ar, store_en, starts_on, ends_on, status)
values ('toys', 'عرض', 'Offer', 'متجر', 'Store', current_date, current_date + 7, 'published');

select throws_ok($$ insert into public.offers (category, title_ar, title_en, store_ar, store_en, starts_on, ends_on)
  values ('formula', 'x', 'x', 'x', 'x', current_date, current_date) $$, '23514', null, 'offers can never be for infant formula');
select throws_ok($$ insert into public.places (category, name_ar, name_en, governorate, maps_url)
  values ('hospital', 'x', 'x', 'capital', 'javascript:alert(1)') $$, '23514', null, 'links must be https');
select throws_ok($$ insert into public.places (category, name_ar, name_en, governorate, phone)
  values ('hospital', 'x', 'x', 'capital', '+4477') $$, '23514', null, 'phone numbers must be Kuwaiti');

set local role anon;
select ok((select count(*) from public.guides) >= 7, 'visitors can read published guides');
select is((select count(*)::int from public.guides where slug = 'draft-guide'), 0, 'draft guides are hidden');
select ok((select count(*) from public.guide_steps) > 10, 'visitors can read the steps of published guides');
select is((select count(*)::int from public.offers), 1, 'visitors see published offers');
reset role;

insert into auth.users (id, phone, aud, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '96599990010', 'authenticated', 'authenticated'),
  ('aaaaaaaa-0000-0000-0000-000000000002', '96599990011', 'authenticated', 'authenticated');
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select public.create_family('Dana', 'privacy-2026-11-draft');
insert into public.children (family_id, first_name, birth_date, gender) values (public.my_family_id(), 'Ali', current_date - 30, 'boy');
select lives_ok($$ insert into public.guide_progress (family_id, child_id, step_id)
  select public.my_family_id(), (select id from public.children), (select id from public.guide_steps order by id limit 1) $$,
  'a parent ticks off a guide step for their child');
select throws_ok($$ insert into public.guides (slug, topic, audience, title_ar, title_en, summary_ar, summary_en) values ('x-x-x', 'birth', 'all', 'x', 'x', 'x', 'x') $$,
  '42501', null, 'parents cannot write guides');

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}', true);
select public.create_family('Other', 'privacy-2026-11-draft');
select is((select count(*)::int from public.guide_progress), 0, 'another family cannot see the progress');

select * from finish();
rollback;
