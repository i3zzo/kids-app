'use client';
// List + form for one content type, with the review workflow:
//   draft -> in review -> published
// The buttons a role can't use are hidden, but the database is the real check
// (content_review_guard): e.g. an editor's "publish" on health content fails.
import { useCallback, useEffect, useState } from 'react';
import { canPublish, CONTENT, STEP_FIELDS, toForm, toRow } from '@/lib/content';
import { errorText, supabase } from '@/lib/supabase';
import { Fields } from './Fields';
import { useStaff } from './Shell';

const PAGE = 50;
type Row = Record<string, unknown> & { id: string; status: string; reviewed_at?: string | null };
type Status = 'all' | 'draft' | 'in_review' | 'published';

export function ContentEditor({ type }: { type: keyof typeof CONTENT }) {
  const ct = CONTENT[type];
  const { role } = useStaff();
  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState<Status>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [editing, setEditing] = useState<Row | 'new' | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    let q = supabase.from(ct.table).select(['id', 'status', 'reviewed_at', ...ct.listColumns].join(', '));
    if (status !== 'all') q = q.eq('status', status);
    const s = search.trim().replace(/[%_,()*]/g, ' ');
    if (s) q = q.or(ct.searchColumns.map((c) => `${c}.ilike.*${s}*`).join(','));
    const { data, error } = await q.order(ct.order).order('id').range(page * PAGE, page * PAGE + PAGE);
    if (error) return setMessage({ ok: false, text: errorText(error) });
    const list = (data ?? []) as unknown as Row[];
    setHasMore(list.length > PAGE);
    setRows(list.slice(0, PAGE));
  }, [ct, status, search, page]);

  useEffect(() => {
    const h = setTimeout(load, 250);
    return () => clearTimeout(h);
  }, [load]);

  async function open(id: string | 'new') {
    setMessage(null);
    if (id === 'new') {
      setEditing('new');
      setValues(toForm(ct.fields, ct.defaults));
      return;
    }
    const { data, error } = await supabase.from(ct.table).select('*').eq('id', id).single();
    if (error) return setMessage({ ok: false, text: errorText(error) });
    setEditing(data as Row);
    setValues(toForm(ct.fields, data as Row));
  }

  async function save(nextStatus?: string) {
    setBusy(true);
    setMessage(null);
    const row = toRow(ct.fields, values);
    if (nextStatus) row.status = nextStatus;
    const res =
      editing === 'new'
        ? await supabase.from(ct.table).insert({ ...row, status: nextStatus ?? 'draft' }).select('*').single()
        : await supabase.from(ct.table).update(row).eq('id', (editing as Row).id).select('*').single();
    setBusy(false);
    if (res.error) return setMessage({ ok: false, text: errorText(res.error) });
    const saved = res.data as Row;
    setEditing(saved);
    setMessage({
      ok: true,
      text:
        nextStatus === 'published' && saved.status === 'published'
          ? 'Published. Parents see it now.'
          : saved.status === 'in_review' && nextStatus !== 'in_review'
            ? 'Saved. Because this is health content, it went back to review.'
            : 'Saved.',
    });
    load();
  }

  async function remove() {
    if (editing === 'new' || !editing || !confirm('Delete this item for good?')) return;
    const { error } = await supabase.from(ct.table).delete().eq('id', editing.id);
    if (error) return setMessage({ ok: false, text: errorText(error) });
    setEditing(null);
    load();
  }

  const current = editing && editing !== 'new' ? editing : null;
  const mayPublish = canPublish(role, ct.kind);

  return (
    <div className="editor">
      <section className="list">
        <header>
          <h1>{ct.title}</h1>
          <button onClick={() => open('new')} data-testid="new">+ New</button>
        </header>
        {ct.hint ? <p className="hint">{ct.hint}</p> : null}
        <div className="filters">
          {(['all', 'draft', 'in_review', 'published'] as Status[]).map((s) => (
            <button key={s} className={status === s ? 'tab active' : 'tab'} onClick={() => { setPage(0); setStatus(s); }}>
              {s.replace('_', ' ')}
            </button>
          ))}
          <input placeholder="Search" value={search} onChange={(e) => { setPage(0); setSearch(e.target.value); }} />
        </div>
        <table>
          <thead>
            <tr>
              {ct.listColumns.map((c) => <th key={c}>{c.replace(/_/g, ' ')}</th>)}
              <th>status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} onClick={() => open(r.id)} className={current?.id === r.id ? 'selected' : ''}>
                {ct.listColumns.map((c) => <td key={c}>{r[c] == null ? '—' : String(r[c])}</td>)}
                <td><span className={`status ${r.status}`}>{r.status.replace('_', ' ')}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="pager">
          {page > 0 ? <button className="link" onClick={() => setPage(page - 1)}>← Previous</button> : <span />}
          {hasMore ? <button className="link" onClick={() => setPage(page + 1)}>Next →</button> : null}
        </div>
      </section>

      {editing ? (
        <section className="form card">
          <header>
            <h2>{editing === 'new' ? 'New item' : 'Edit'}</h2>
            {current ? <span className={`status ${current.status}`}>{current.status.replace('_', ' ')}</span> : null}
          </header>
          {current?.status === 'published' && current.reviewed_at ? (
            <p className="hint">Published {new Date(current.reviewed_at).toLocaleString('en-GB')}</p>
          ) : null}
          <Fields fields={ct.fields} values={values} onChange={(k, v) => setValues((x) => ({ ...x, [k]: v }))} />
          {message ? <p className={message.ok ? 'ok' : 'error'} data-testid="message">{message.text}</p> : null}
          <div className="actions">
            <button onClick={() => save()} disabled={busy} data-testid="save">Save</button>
            {current?.status !== 'in_review' && current?.status !== 'published' ? (
              <button className="secondary" onClick={() => save('in_review')} disabled={busy} data-testid="review">Send for review</button>
            ) : null}
            {mayPublish && current?.status !== 'published' ? (
              <button className="publish" onClick={() => save('published')} disabled={busy} data-testid="publish">Publish</button>
            ) : null}
            {current?.status === 'published' ? (
              <button className="secondary" onClick={() => save('draft')} disabled={busy}>Unpublish</button>
            ) : null}
            {current ? <button className="danger" onClick={remove} disabled={busy}>Delete</button> : null}
          </div>
          {!mayPublish && ct.kind === 'health' ? <p className="hint">Health content: a health reviewer publishes it.</p> : null}
          {type === 'guides' && current ? <StepsEditor guideId={current.id} /> : null}
        </section>
      ) : null}
    </div>
  );
}

function StepsEditor({ guideId }: { guideId: string }) {
  const [steps, setSteps] = useState<Record<string, unknown>[]>([]);
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('guide_steps').select('*').eq('guide_id', guideId).order('position');
    if (error) setError(errorText(error));
    else setSteps(data ?? []);
  }, [guideId]);
  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    setError(null);
    const row = toRow(STEP_FIELDS, values);
    const res =
      editing === 'new'
        ? await supabase.from('guide_steps').insert({ ...row, guide_id: guideId })
        : await supabase.from('guide_steps').update(row).eq('id', editing!);
    if (res.error) return setError(errorText(res.error));
    setEditing(null);
    load();
  }
  async function remove(id: string) {
    if (!confirm('Delete this step?')) return;
    const { error } = await supabase.from('guide_steps').delete().eq('id', id);
    if (error) setError(errorText(error));
    load();
  }

  return (
    <div className="steps">
      <h3>Steps</h3>
      {steps.map((s) => (
        <div key={String(s.id)} className="step">
          <span>{String(s.position)}. {String(s.title_en)}</span>
          <span>
            <button className="link" onClick={() => { setEditing(String(s.id)); setValues(toForm(STEP_FIELDS, s)); }}>Edit</button>
            <button className="link danger-text" onClick={() => remove(String(s.id))}>Delete</button>
          </span>
        </div>
      ))}
      {editing ? (
        <div className="card inner">
          <Fields fields={STEP_FIELDS} values={values} onChange={(k, v) => setValues((x) => ({ ...x, [k]: v }))} />
          <div className="actions">
            <button onClick={save}>Save step</button>
            <button className="secondary" onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </div>
      ) : (
        <button className="secondary" onClick={() => { setEditing('new'); setValues(toForm(STEP_FIELDS, { position: steps.length + 1, documents_ar: [], documents_en: [] })); }}>+ Add step</button>
      )}
      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}
