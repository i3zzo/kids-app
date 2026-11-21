-- Events list query plan at 20,000 events (most of them past), as a visitor. Rolled back.
--   docker exec -i supabase_db_yahal psql -U postgres < supabase/perf/events.sql
begin;
insert into public.kids_events (title_ar, title_en, starts_on, ends_on, source_url, source_checked_on, status)
select 'فعالية ' || i, 'Event ' || i, current_date - 1000 + (i % 1100), current_date - 1000 + (i % 1100) + (i % 5), 'https://example.com', current_date, 'published'
from generate_series(1, 20000) i;
analyze public.kids_events;
set local role anon;
\echo '--- Events: on now and coming up, first page'
explain (analyze, buffers, costs off, summary on)
select id, title_en, starts_on, ends_on from public.kids_events
where ends_on >= current_date order by ends_on, starts_on, id limit 20;
rollback;
