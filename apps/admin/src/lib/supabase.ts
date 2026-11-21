// The admin panel uses the same public anon key as the app. Staff sign in with
// their phone; what they may do is decided by the database (staff roles).
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const isConfigured = Boolean(url && anonKey);

export const supabase = createClient(url ?? 'http://missing-config.invalid', anonKey ?? 'missing', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'yahal-admin' },
});

export type StaffRole = 'editor' | 'health_reviewer' | 'super_admin';

export function errorText(e: unknown): string {
  const err = e as { message?: string; code?: string };
  if (err?.code === '42501') return 'Your role is not allowed to do this. ' + (err.message ?? '');
  if (err?.code === '23514') return 'Not saved: one value is not allowed (links must start with https://, phones are +965 and 8 digits, ages 0–131 months). Details: ' + (err.message ?? '');
  if (err?.code === '23505') return 'Not saved: an item with the same name or slug already exists.';
  return err?.message ?? 'Something went wrong';
}
