import type { NextConfig } from 'next';

// A static site: every page runs in the browser and talks to Supabase with the
// public anon key. All permission checks happen in the database (RLS, triggers).
const config: NextConfig = {
  output: 'export',
  trailingSlash: true,
  reactStrictMode: true,
  poweredByHeader: false,
};
export default config;
