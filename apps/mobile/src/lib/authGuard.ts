// Notices when the account behind this phone's saved session no longer
// exists (deleted on another phone, or removed by the team) and signs out
// here, so the parent sees "please sign in again" instead of a network error.
// It only signs out when the auth server itself says the user is gone or the
// session is invalid; a network problem never signs anyone out.
import { supabase } from './supabase';

let reason: 'account_gone' | null = null;
let checking: Promise<boolean> | null = null;
const listeners = new Set<() => void>();

/** Why the app signed out by itself, once (the sign-in screen shows it). */
export function takeSignOutReason() {
  const r = reason;
  reason = null;
  return r;
}
export function onSignOutReason(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Errors that can mean the saved session points to a user that is gone. */
export function mightBeStaleSession(code: string | undefined) {
  // PGRST301/302/303: bad or expired token; 23503: our rows point to a user
  // that no longer exists (e.g. families.created_by); 42501: refused by RLS.
  return code === 'PGRST301' || code === 'PGRST302' || code === 'PGRST303' || code === '23503' || code === '42501';
}

/** Errors that almost surely mean "sign in again" (shown as that message). */
export function isSignedOutError(code: string | undefined) {
  return code === '23503' || code === 'PGRST301' || code === 'PGRST302' || code === 'PGRST303';
}

/**
 * Asks the auth server whether the signed-in user still exists. Signs out on
 * this phone when it doesn't. Returns true when it signed out.
 */
export function verifyAccount(): Promise<boolean> {
  if (!checking) {
    checking = (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) return false;
      const { data, error } = await supabase.auth.getUser();
      const status = (error as { status?: number } | null)?.status;
      const code = (error as { code?: string } | null)?.code;
      const gone =
        (error && (status === 401 || status === 403) && code !== 'over_request_rate_limit') ||
        (!error && !data.user);
      if (!gone) return false;
      reason = 'account_gone';
      // Local only: the server session is already invalid.
      await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
      listeners.forEach((fn) => fn());
      return true;
    })()
      .catch(() => false)
      .finally(() => {
        checking = null;
      });
  }
  return checking;
}
