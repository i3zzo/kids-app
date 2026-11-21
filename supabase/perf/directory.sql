-- Directory query plans at 20,000 published listings (about 100x what is
-- loaded today), as a visitor (anon), so RLS is included. Rolled back.
--   docker exec -i supabase_db_yahal psql -U postgres < supabase/perf/directory.sql
begin;
insert into public.places (category, name_ar, name_en, governorate, area_en, status)
select (array['activity','nursery','school','hospital','paediatrician','toy_store','clothing_store'])[1 + i % 7],
       'مكان ' || i, 'Place ' || lpad(i::text, 5, '0'),
       (array['capital','hawalli','farwaniya','mubarak_al_kabeer','ahmadi','jahra'])[1 + i % 6], 'Area', 'published'
from generate_series(1, 20000) i;
-- About 1 in 10 synthetic listings get special-needs tags, as in the real data.
update public.places set special_needs_services = (array['{autism}','{speech,learning}','{all_needs}','{physical,physio}','{general}'])[1 + abs(hashtext(name_en)) % 5]::text[],
  special_needs_source_url = 'https://example.com'
where name_en like 'Place %' and right(name_en, 1) = '7';
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
\echo '--- Special needs: one category, any need, page 1'
explain (analyze, buffers, costs off, summary on)
select id, name_en from public.places
where category = 'school' and special_needs_services <> '{}' order by name_en, id limit 20;
\echo '--- Special needs: one category, one governorate, any need'
explain (analyze, buffers, costs off, summary on)
select id, name_en from public.places
where category = 'school' and governorate = 'jahra' and special_needs_services <> '{}' order by name_en, id limit 20;
\echo '--- Special needs: one category, autism (or all disabilities)'
explain (analyze, buffers, costs off, summary on)
select id, name_en from public.places
where category = 'school' and special_needs_services && '{autism,all_needs}' order by name_en, id limit 20;
rollback;
