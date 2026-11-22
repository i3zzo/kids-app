#!/usr/bin/env bash
# Puts the whole Yahal database (tables, security rules, vaccine schedule, tips,
# guides, 361 directory places, events) on a HOSTED Supabase test project, and
# deploys the AI tips function. Run from the repo root on your own computer:
#
#   bash scripts/test-env/setup-supabase.sh <project-ref>
#
# <project-ref> is the id in your project's URL: https://<project-ref>.supabase.co
# The CLI asks for the database password you chose when creating the project.
# Safe to run again: it only applies migrations the server doesn't have yet.
set -euo pipefail
REF="${1:?Usage: bash scripts/test-env/setup-supabase.sh <project-ref>}"
CLI="npx --yes supabase@3.2.0"   # same version as CI and local development

cd "$(dirname "$0")/../.."
$CLI login                        # opens the browser once; skipped if already logged in
$CLI link --project-ref "$REF"
echo "Migrations that will be applied:"
$CLI migration list
$CLI db push
# Without OMNIROUTE_* secrets the function answers "AI not set up yet" and the app
# shows the normal tips, so it's safe to deploy now and add the key later with:
#   npx supabase@3.2.0 secrets set OMNIROUTE_BASE_URL=... OMNIROUTE_API_KEY=...
$CLI functions deploy tips-ai
echo
echo "Done. Now finish the 3 dashboard settings in docs/launch/test-version.md, step 1."
