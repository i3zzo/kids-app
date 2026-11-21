// Who is signed in, and which family they belong to.
// The app reads this to decide which screens to show. It is NOT a security
// check — the database enforces who can see what.
import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { forgetThisPhone, forgetThisPhoneLocally } from './notifications';
import { deleteMyAccount } from './api';
import { verifyAccount } from './authGuard';
import { supabase } from './supabase';

export type FamilyRole = 'owner' | 'co_parent';
export type Membership = { familyId: string; role: FamilyRole; familyName: string };

type SessionState = {
  /** undefined while loading */
  session: Session | null | undefined;
  /** undefined while loading, null when the parent has no family yet */
  membership: Membership | null | undefined;
  /** true once the family has at least one child (onboarding finished) */
  hasChildren: boolean | undefined;
  /** true when we couldn't reach the server to load the family (e.g. no internet) */
  loadFailed: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
  /** Permanently deletes the account on the server, then signs out here. */
  deleteAccount: () => Promise<void>;
};

const Ctx = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [membership, setMembership] = useState<Membership | null | undefined>(undefined);
  const [hasChildren, setHasChildren] = useState<boolean | undefined>(undefined);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      // Once per app start: is the saved account still there? (It may have
      // been deleted on another phone.) If not, this signs out.
      if (data.session) void verifyAccount();
    });
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id;

  const refresh = useCallback(async () => {
    if (!userId) {
      setMembership(null);
      setHasChildren(undefined);
      return;
    }
    // One round trip: membership + family name (nested select), and in
    // parallel a cheap "is there at least one child?" check.
    const [m, c] = await Promise.all([
      supabase
        .from('family_members')
        .select('family_id, role, families(name)')
        .eq('user_id', userId)
        .maybeSingle(),
      supabase.from('children').select('id').limit(1),
    ]);
    if (m.error) throw m.error;
    if (c.error) throw c.error;
    setLoadFailed(false);
    const row = m.data as unknown as { family_id: string; role: FamilyRole; families: { name: string } | null } | null;
    setMembership(row ? { familyId: row.family_id, role: row.role, familyName: row.families?.name ?? '' } : null);
    setHasChildren((c.data?.length ?? 0) > 0);
  }, [userId]);

  useEffect(() => {
    if (session === undefined) return;
    setMembership(undefined);
    // If the server can't be reached, don't pretend the parent has no family
    // (that would send them to "Create family"). Show a retry screen instead.
    refresh().catch(async () => {
      // Signed out because the account is gone: the sign-in screen shows why.
      if (await verifyAccount()) return;
      setLoadFailed(true);
    });
  }, [session, refresh]);

  const signOut = useCallback(async () => {
    // Stop reminders for this account on this phone first (needs the session).
    await forgetThisPhone();
    await supabase.auth.signOut();
  }, []);

  const deleteAccount = useCallback(async () => {
    await deleteMyAccount();
    // The server has already removed the login, devices and settings.
    await forgetThisPhoneLocally();
    await supabase.auth.signOut({ scope: 'local' });
  }, []);

  const value = useMemo(
    () => ({ session, membership, hasChildren, loadFailed, refresh, signOut, deleteAccount }),
    [session, membership, hasChildren, loadFailed, refresh, signOut, deleteAccount],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSession must be used inside SessionProvider');
  return v;
}

/** Use inside screens that only render after onboarding. */
export function useFamily(): Membership {
  const { membership } = useSession();
  if (!membership) throw new Error('No family yet');
  return membership;
}
