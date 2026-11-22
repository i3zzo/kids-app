#!/usr/bin/env bash
# Builds the web test version of the app (a folder of static files) that points
# at the hosted TEST server. Run from the repo root:
#
#   bash scripts/test-env/build-web.sh
#
# Reads apps/mobile/.env.test.local (git ignores it):
#   EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
#   EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon / publishable key>
# Output: apps/mobile/dist  (upload that folder to Netlify or Cloudflare Pages).
set -euo pipefail
cd "$(dirname "$0")/../../apps/mobile"
ENV_FILE=.env.test.local
[ -f "$ENV_FILE" ] || { echo "Create apps/mobile/$ENV_FILE first (see docs/launch/test-version.md)"; exit 1; }
set -a; . "./$ENV_FILE"; set +a
case "${EXPO_PUBLIC_SUPABASE_URL:-}" in
  https://*) ;;
  *) echo "EXPO_PUBLIC_SUPABASE_URL must be the hosted https:// address"; exit 1 ;;
esac
[ -d node_modules ] || npm ci
rm -rf dist
# Values already in the environment win over apps/mobile/.env, so your local
# development settings stay untouched.
npx expo export -p web --clear
echo "Built apps/mobile/dist for $EXPO_PUBLIC_SUPABASE_URL"
