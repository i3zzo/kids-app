'use client';
// Staff accounts (super admin only; the database refuses everyone else).
import { useEffect, useState } from 'react';
import { useStaff } from '@/components/Shell';
import { errorText, supabase, type StaffRole } from '@/lib/supabase';

type Member = { user_id: string; role: StaffRole; display_name: string; active: boolean; created_at: string };
const ROLES: StaffRole[] = ['editor', 'health_reviewer', 'super_admin'];

export default function Staff() {
  const { userId } = useStaff();
  const [list, setList] = useState<Member[]>([]);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<StaffRole>('editor');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function load() {
    const { data, error } = await supabase.from('staff').select('user_id, role, display_name, active, created_at').order('created_at');
    if (error) setMsg({ ok: false, text: errorText(error) });
    setList((data ?? []) as Member[]);
  }
  useEffect(() => {
    load();
  }, []);

  async function add() {
    const digits = phone.replace(/\D/g, '').replace(/^965/, '');
    const { error } = await supabase.rpc('add_staff', { staff_phone: '965' + digits, new_role: role, name: name.trim() });
    setMsg(error ? { ok: false, text: errorText(error) } : { ok: true, text: 'Added.' });
    if (!error) { setPhone(''); setName(''); }
    load();
  }
  async function update(m: Member, patch: Partial<Member>) {
    const { error } = await supabase.from('staff').update(patch).eq('user_id', m.user_id);
    setMsg(error ? { ok: false, text: errorText(error) } : { ok: true, text: 'Updated.' });
    load();
  }

  return (
    <div>
      <h1>Staff</h1>
      <p className="hint">The person must sign in to the admin panel once with their phone before you can add them. You can&apos;t change your own role, so the team can never be left without a super admin by mistake.</p>
      <div className="card grid">
        <label>Phone<input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="5XXX XXXX" /></label>
        <label>Name<input value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label>Role<select value={role} onChange={(e) => setRole(e.target.value as StaffRole)}>{ROLES.map((r) => <option key={r}>{r}</option>)}</select></label>
        <div className="actions"><button onClick={add} disabled={!name.trim() || phone.replace(/\D/g, '').length < 8}>Add</button></div>
      </div>
      {msg ? <p className={msg.ok ? 'ok' : 'error'}>{msg.text}</p> : null}
      <table>
        <thead><tr><th>Name</th><th>Role</th><th>Active</th><th>Since</th></tr></thead>
        <tbody>
          {list.map((m) => (
            <tr key={m.user_id}>
              <td>{m.display_name}{m.user_id === userId ? ' (you)' : ''}</td>
              <td>
                <select value={m.role} disabled={m.user_id === userId} onChange={(e) => update(m, { role: e.target.value as StaffRole })}>
                  {ROLES.map((r) => <option key={r}>{r}</option>)}
                </select>
              </td>
              <td><input type="checkbox" checked={m.active} disabled={m.user_id === userId} onChange={(e) => update(m, { active: e.target.checked })} /></td>
              <td>{new Date(m.created_at).toLocaleDateString('en-GB')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
