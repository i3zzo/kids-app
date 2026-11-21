-- Directory query plans at 20,000 published listings (about 100x what is
-- loaded today), as a visitor (anon), so RLS is included. Rolled back.
--   docker exec -i supabase_db_yahal psql -U postgres < supabase/perf/directory.sql
begin;
insert into public.places (category, name_ar, name_en, governorate, area_en, status)
select (array['activity','nursery','school','hospital','paediatrician','toy_store','clothing_store'])[1 + i % 7],
       'مكان ' || i, 'Place ' || lpad(i::text, 5, '0'),
       (array['capital','hawalli','farwaniya','mubarak_al_kabeer','ahmadi','jahra'])[1 + i % 6], 'Area', 'published'
from generate_series(1, 20000) i;
analyze public.places;
set local role anon;
\echo '--- Directory: one category, one governorate, page 3'
explain (analyze, buffers, costs off, summary on)
select id, name_en, price_min_kwd from public.places
where category = 'nursery' and governorate = 'hawalli' order by name_en, id limit 20 offset 40;
\echo '--- Directory: one category, all governorates, page 3'
explain (analyze, buffers, costs off, summary on)
select id, name_en, price_min_kwd from public.places
where category = 'nursery' order by name_en, id limit 20 offset 40;
\echo '--- Directory: one category, name search'
explain (analyze, buffers, costs off, summary on)
select id, name_en, price_min_kwd from public.places
where category = 'nursery' and (name_ar ilike '%Mont%' or name_en ilike '%Mont%') order by name_en, id limit 20;
rollback;
