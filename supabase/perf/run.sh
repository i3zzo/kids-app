#!/usr/bin/env bash
# Load the scale data into the LOCAL database and print timings (ms) for each
# query in explain.sql, three runs each. Never point this at the real server.
set -euo pipefail
cd "$(dirname "$0")/../.."
npx supabase db reset > /dev/null
docker exec -i supabase_db_yahal psql -U postgres -q < supabase/perf/seed_scale.sql > /dev/null
docker exec supabase_db_yahal psql -U postgres -qc "vacuum analyze public.events, public.child_vaccinations, public.supply_items, public.notification_log, public.children, public.family_members" > /dev/null
docker exec -i supabase_db_yahal psql -U postgres < supabase/perf/explain.sql | grep -E '^--- ' | sed 's/^--- //' > /tmp/perf-names.txt
for i in 1 2 3; do
  docker exec -i supabase_db_yahal psql -U postgres < supabase/perf/explain.sql | grep 'Execution Time' | awk '{print $3}' > "/tmp/perf-run$i.txt"
done
paste -d'|' /tmp/perf-names.txt /tmp/perf-run1.txt /tmp/perf-run2.txt /tmp/perf-run3.txt
