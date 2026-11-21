-- Directory listings: every researched listing records its source, prices
-- can't be added without one, and nothing is marked as checked by the team.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

select ok((select count(*) from public.places where ref is not null) >= 270, 'the researched listings are loaded');
select is((select count(distinct governorate)::int from public.places where category = 'medical_centre'), 6, 'medical centres in every governorate');
select is((select count(*)::int from public.places where name_en = 'Al-Adan Hospital'), 1, 'the step 5 hospitals were updated, not duplicated');
select is((select count(*)::int from public.places where ref is not null and (source_url is null or source_checked_on is null)), 0,
  'every listing says where it came from and when');
select is((select count(*)::int from public.places where ref is not null and verified_on is not null), 0,
  'no listing is marked as confirmed by the team');
select is((select count(distinct governorate)::int from public.places where status = 'published'), 6, 'all six governorates have listings');

select throws_ok($$ insert into public.places (category, name_ar, name_en, governorate, price_min_kwd) values ('nursery', 'x', 'x', 'capital', 100) $$,
  '23514', null, 'a price needs a source and a date');
select throws_ok($$ insert into public.places (category, name_ar, name_en, governorate, price_min_kwd, price_max_kwd, source_url, source_checked_on)
  values ('nursery', 'x', 'x', 'capital', 100, 50, 'https://example.com', current_date) $$, '23514', null, 'a range cannot run backwards');
select throws_ok($$ insert into public.places (category, name_ar, name_en, governorate, source_url) values ('nursery', 'x', 'x', 'capital', 'http://example.com') $$,
  '23514', null, 'sources must be https');

set local role anon;
select ok((select price_min_kwd from public.places where ref = 'activity-kidzania-kuwait-al-rai') = 14, 'visitors can read prices');
select is((select count(*)::int from public.places where category = 'school' and governorate = 'jahra'), 2, 'the governorate filter works on the new rows');
reset role;

-- Events and trending
insert into public.kids_events (title_ar, title_en, starts_on, ends_on, source_url, source_checked_on, status)
values ('مسودة', 'Draft event', current_date, current_date + 3, 'https://example.com', current_date, 'draft');
select throws_ok($$ insert into public.kids_events (title_ar, title_en, starts_on, ends_on, source_url, source_checked_on)
  values ('x', 'x', current_date, current_date, 'http://example.com', current_date) $$, '23514', null, 'event sources must be https');
select throws_ok($$ insert into public.kids_events (title_ar, title_en, starts_on, ends_on, source_url, source_checked_on)
  values ('x', 'x', current_date, current_date - 1, 'https://example.com', current_date) $$, '23514', null, 'an event cannot end before it starts');
set local role anon;
select ok((select count(*) from public.kids_events where ref = 'kuwait-international-book-fair-2026') = 1, 'visitors can read published events');
select is((select count(*)::int from public.kids_events where title_en = 'Draft event'), 0, 'draft events are hidden');
select ok((select count(*) from public.places where trending_until >= '2026-11-21') >= 2, 'trending places are readable');
reset role;

select * from finish();
rollback;
