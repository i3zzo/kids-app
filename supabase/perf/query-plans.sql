-- Query-plan check for the app's main reads (performance standard item 1).
-- Loads ~5,000 synthetic families into a transaction, runs EXPLAIN ANALYZE
-- for each screen's query as a signed-in parent (so RLS is included), then
-- rolls everything back. Local database only:
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/perf/query-plans.sql
begin;
set local client_min_messages = warning;

insert into auth.users (id, phone, aud, role)
select gen_random_uuid(), '9659' || lpad(g::text, 7, '0'), 'authenticated', 'authenticated'
from generate_series(1, 5000) g;

insert into public.families (id, name, created_by, privacy_version)
select gen_random_uuid(), 'F' || row_number() over (), id, 'perf' from auth.users where phone like '9659%';
insert into public.family_members (family_id, user_id, role)
select id, created_by, 'owner' from public.families where privacy_version = 'perf';

-- 2 children per family (the trigger generates their vaccination schedules)
insert into public.children (family_id, first_name, birth_date, gender)
select f.id, 'C' || k, current_date - ((random() * 3000)::int), case when k = 1 then 'girl' else 'boy' end
from public.families f, generate_series(1, 2) k where f.privacy_version = 'perf';

-- 20 events per family spread over a year
insert into public.events (family_id, title, starts_at, created_by)
select f.id, 'E', now() - interval '180 days' + (random() * 365) * interval '1 day', f.created_by
from public.families f, generate_series(1, 20) where f.privacy_version = 'perf';

analyze;

select 'rows' as info,
  (select count(*) from public.children) as children,
  (select count(*) from public.child_vaccinations) as vaccinations,
  (select count(*) from public.events) as events;

-- act as one parent
select set_config('request.jwt.claims', json_build_object('sub', created_by, 'role', 'authenticated')::text, true),
       set_config('perf.family', id::text, true)
from public.families where privacy_version = 'perf' limit 1;
set local role authenticated;

\echo '--- Calendar: events in visible month'
explain (analyze, buffers, costs off, timing on, summary on)
select id, child_id, kind, title, starts_at, ends_at, all_day, location, notes
from public.events
where family_id = current_setting('perf.family')::uuid
  and starts_at >= date_trunc('month', now()) - interval '7 days'
  and starts_at < date_trunc('month', now()) + interval '42 days'
order by starts_at, id;

\echo '--- Calendar: vaccinations in visible month (with nested dose info)'
explain (analyze, buffers, costs off, timing on, summary on)
select cv.id, cv.child_id, cv.due_date, cv.status, d.name_ar, d.name_en
from public.child_vaccinations cv
join public.vaccine_doses d on d.id = cv.dose_id
where cv.family_id = current_setting('perf.family')::uuid
  and cv.due_date between current_date - 7 and current_date + 42
order by cv.due_date, cv.id;

\echo '--- Home: open doses up to 90 days ahead'
explain (analyze, buffers, costs off, timing on, summary on)
select cv.id, cv.child_id, cv.due_date
from public.child_vaccinations cv
where cv.family_id = current_setting('perf.family')::uuid
  and cv.status = 'due' and cv.due_date <= current_date + 90
order by cv.due_date, cv.id limit 30;

\echo '--- Family: children list'
explain (analyze, buffers, costs off, timing on, summary on)
select id, first_name, birth_date, gender, nationality_group, color
from public.children order by birth_date, id;

rollback;
