-- Query plans and timings for what the app and the reminder jobs run, at the
-- scale loaded by seed_scale.sql. Runs as a real parent (family 777), so Row
-- Level Security is part of every plan. Everything is rolled back.
--   docker exec -i supabase_db_yahal psql -U postgres < supabase/perf/explain.sql
begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000309","role":"authenticated"}', true);
set local role authenticated;
\echo '--- Home: one-off events this week'
explain (analyze, buffers, costs off, summary on)
select id, child_id, kind, title, starts_at from public.events
where family_id = public.my_family_id() and repeat = 'none' and starts_at >= now() and starts_at < now() + interval '8 days'
order by starts_at, id;
\echo '--- Home: repeating events'
explain (analyze, buffers, costs off, summary on)
select id, starts_at, repeat from public.events
where family_id = public.my_family_id() and repeat <> 'none' and starts_at < now() + interval '8 days'
  and (repeat_until is null or repeat_until >= current_date)
order by starts_at limit 200;
\echo '--- Home: open vaccinations with dose names'
explain (analyze, buffers, costs off, summary on)
select cv.id, cv.due_date, d.name_en from public.child_vaccinations cv join public.vaccine_doses d on d.id = cv.dose_id
where cv.family_id = public.my_family_id() and cv.status = 'due' and cv.due_date <= current_date + 90
order by cv.due_date, cv.id limit 30;
\echo '--- Home: running low'
explain (analyze, buffers, costs off, summary on)
select id, name, quantity from public.supply_items where family_id = public.my_family_id() and is_low order by quantity, id limit 20;
\echo '--- Supplies tab: one child'
explain (analyze, buffers, costs off, summary on)
select id, name, quantity from public.supply_items where child_id = (select id from public.children limit 1) order by category, name;
\echo '--- Export my data'
explain (analyze, buffers, costs off, summary on) select public.export_my_data();
rollback;

\echo '--- Job: event and vaccine reminders (every 5 minutes, all families)'
begin;
explain (analyze, buffers, costs off, summary on) select public.queue_due_reminders();
rollback;
\echo '--- Job: running-low reminders (once a day, all families)'
begin;
explain (analyze, buffers, costs off, summary on) select public.queue_supply_reminders();
\echo '--- Job: running-low reminders, the next 5-minute call the same evening'
explain (analyze, buffers, costs off, summary on) select public.queue_supply_reminders();
rollback;

\echo '--- Delete an owner account (cascades through the whole family)'
begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000309","role":"authenticated"}', true);
set local role authenticated;
explain (analyze, buffers, costs off, summary on) select public.delete_my_account('DELETE');
rollback;
