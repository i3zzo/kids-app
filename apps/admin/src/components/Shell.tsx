'use client';
// Sign-in (phone + SMS code, through Supabase Auth) and the side menu.
// Shows only to staff. The menu hides what a role can't use, but the database
// is what actually enforces the role.
import type { Session } from '@supabase/supabase-js';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { errorText, isConfigured, supabase, type StaffRole } from '@/lib/supabase';

const RoleCtx = createContext<{ role: StaffRole; userId: string } | null>(null);
export function useStaff() {
  const v = useContext(RoleCtx);
  if (!v) throw new Error('useStaff outside Shell');
  return v;
}

const MENU: { href: string; label: string; roles?: StaffRole[] }[] = [
  { href: '/', label: 'Overview' },
  { href: '/places/', label: 'Directory' },
  { href: '/offers/', label: 'Offers' },
  { href: '/guides/', label: 'Government guides' },
  { href: '/brands/', label: 'Brands' },
  { href: '/suggestions/', label: 'Suggested supplies' },
  { href: '/vaccines/', label: 'Vaccination schedule' },
  { href: '/staff/', label: 'Staff', roles: ['super_admin'] },
  { href: '/audit/', label: 'Audit log', roles: ['super_admin'] },
];

export function Shell({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [role, setRole] = useState<StaffRole | null | undefined>(undefined);
  const path = usePathname();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!session) return setRole(session === null ? null : undefined);
    supabase.rpc('staff_role').then(({ data }) => setRole((data as StaffRole | null) ?? null));
  }, [session]);

  if (!isConfigured) return <main className="center"><p>Copy <code>.env.example</code> to <code>.env.local</code> and add the Supabase URL and anon key.</p></main>;
  if (session === undefined || (session && role === undefined)) return <main className="center"><p>Loading…</p></main>;
  if (!session) return <SignIn />;
  if (!role)
    return (
      <main className="center">
        <div className="card narrow">
          <h1>Not a staff account</h1>
          <p>This phone number isn&apos;t on the Yahal team. Ask a super admin to add you, then sign in again.</p>
          <button onClick={() => supabase.auth.signOut()}>Sign out</button>
        </div>
      </main>
    );

  return (
    <RoleCtx.Provider value={{ role, userId: session.user.id }}>
      <div className="layout">
        <nav>
          <div className="brand">Yahal · Admin</div>
          {MENU.filter((m) => !m.roles || m.roles.includes(role)).map((m) => (
            <Link key={m.href} href={m.href} className={path === m.href || path + '/' === m.href ? 'active' : ''}>
              {m.label}
            </Link>
          ))}
          <div className="who">
            <span className="pill">{role.replace('_', ' ')}</span>
            <button className="link" onClick={() => supabase.auth.signOut()}>Sign out</button>
          </div>
        </nav>
        <main>{children}</main>
      </div>
    </RoleCtx.Provider>
  );
}

function SignIn() {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const e164 = '+965' + phone.replace(/\D/g, '').replace(/^965/, '');

  async function send() {
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({ phone: e164 });
    setBusy(false);
    if (error) setError(errorText(error));
    else setSent(true);
  }
  async function verify() {
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.verifyOtp({ phone: e164, token: code.trim(), type: 'sms' });
    setBusy(false);
    if (error) setError('Wrong or expired code');
  }

  return (
    <main className="center">
      <div className="card narrow">
        <h1>Yahal admin</h1>
        {!sent ? (
          <>
            <label>Kuwaiti mobile number<input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="5XXX XXXX" inputMode="tel" data-testid="phone" /></label>
            <button onClick={send} disabled={busy || phone.replace(/\D/g, '').length < 8} data-testid="send">Send code</button>
          </>
        ) : (
          <>
            <label>Code sent to {e164}<input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" maxLength={6} data-testid="code" /></label>
            <button onClick={verify} disabled={busy || code.trim().length !== 6} data-testid="verify">Sign in</button>
          </>
        )}
        {error ? <p className="error">{error}</p> : null}
      </div>
    </main>
  );
}
