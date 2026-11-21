'use client';
// Audit log (super admin only): every change to content and staff, newest first.
import { useEffect, useState } from 'react';
import { errorText, supabase } from '@/lib/supabase';

type Entry = { id: number; at: string; actor_role: string | null; table_name: string; row_id: string | null; action: string; before: Record<string, unknown> | null; after: Record<string, unknown> | null };
const PAGE = 50;

function changed(e: Entry) {
  if (!e.before || !e.after) return '';
  return Object.keys(e.after)
    .filter((k) => !['updated_at', 'reviewed_at'].includes(k) && JSON.stringify(e.before![k]) !== JSON.stringify(e.after![k]))
    .join(', ');
}

export default function Audit() {
  const [rows, setRows] = useState<Entry[]>([]);
  const [page, setPage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    supabase
      .from('audit_log')
      .select('id, at, actor_role, table_name, row_id, action, before, after')
      .order('at', { ascending: false })
      .range(page * PAGE, page * PAGE + PAGE - 1)
      .then(({ data, error }) => (error ? setError(errorText(error)) : setRows((data ?? []) as Entry[])));
  }, [page]);
  return (
    <div>
      <h1>Audit log</h1>
      {error ? <p className="error">{error}</p> : null}
      <table>
        <thead><tr><th>When</th><th>Role</th><th>What</th><th>Action</th><th>Fields changed</th></tr></thead>
        <tbody>
          {rows.map((e) => (
            <tr key={e.id}>
              <td>{new Date(e.at).toLocaleString('en-GB')}</td>
              <td>{e.actor_role ?? 'system'}</td>
              <td>{e.table_name} · {String(e.after?.name_en ?? e.after?.title_en ?? e.before?.name_en ?? e.before?.title_en ?? e.row_id ?? '')}</td>
              <td>{e.action}</td>
              <td>{changed(e)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="pager">
        {page > 0 ? <button className="link" onClick={() => setPage(page - 1)}>← Newer</button> : <span />}
        {rows.length === PAGE ? <button className="link" onClick={() => setPage(page + 1)}>Older →</button> : null}
      </div>
    </div>
  );
}
