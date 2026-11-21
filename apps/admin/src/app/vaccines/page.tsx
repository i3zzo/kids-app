'use client';
// Vaccination schedule versions. Health reviewers write the review note shown
// in the app and mark the schedule as checked. Doses are read-only here.
import { useEffect, useState } from 'react';
import { useStaff } from '@/components/Shell';
import { errorText, supabase } from '@/lib/supabase';

type Version = { id: string; code: string; title_en: string; review_note_ar: string | null; review_note_en: string | null; is_current: boolean; reviewed_at: string | null };
type Dose = { id: string; vaccine_code: string; name_en: string; dose_label_en: string; age_months: number; only_gender: string | null };

export default function Vaccines() {
  const { role } = useStaff();
  const [versions, setVersions] = useState<Version[]>([]);
  const [doses, setDoses] = useState<Dose[]>([]);
  const [notes, setNotes] = useState<Record<string, { ar: string; en: string }>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const reviewer = role === 'health_reviewer';

  async function load() {
    const [v, d] = await Promise.all([
      supabase.from('vaccine_schedule_versions').select('id, code, title_en, review_note_ar, review_note_en, is_current, reviewed_at').order('code'),
      supabase.from('vaccine_doses').select('id, vaccine_code, name_en, dose_label_en, age_months, only_gender').order('age_months').order('vaccine_code'),
    ]);
    setVersions((v.data ?? []) as Version[]);
    setDoses((d.data ?? []) as Dose[]);
    setNotes(Object.fromEntries(((v.data ?? []) as Version[]).map((x) => [x.id, { ar: x.review_note_ar ?? '', en: x.review_note_en ?? '' }])));
  }
  useEffect(() => {
    load();
  }, []);

  async function saveNote(id: string) {
    const n = notes[id];
    const { error } = await supabase.from('vaccine_schedule_versions').update({ review_note_ar: n.ar || null, review_note_en: n.en || null }).eq('id', id);
    setMsg(error ? errorText(error) : 'Note saved.');
    load();
  }
  async function markReviewed(id: string) {
    if (!confirm('Confirm you have checked every dose against the current MOH schedule.')) return;
    const { error } = await supabase.rpc('mark_schedule_reviewed', { version: id });
    setMsg(error ? errorText(error) : 'Marked as checked.');
    load();
  }

  return (
    <div>
      <h1>Vaccination schedule</h1>
      <p className="hint">Only a health reviewer can change review notes or mark a schedule as checked. Changing doses needs a new schedule version (a database migration), so families&apos; records stay consistent.</p>
      {versions.map((v) => (
        <div key={v.id} className="card">
          <h2>{v.title_en} {v.is_current ? <span className="pill">current</span> : null}</h2>
          <p>{v.reviewed_at ? `Checked by a health reviewer on ${new Date(v.reviewed_at).toLocaleDateString('en-GB')}` : 'Not yet checked by a health reviewer.'}</p>
          <label>Review note shown in the app (Arabic)<textarea dir="rtl" disabled={!reviewer} value={notes[v.id]?.ar ?? ''} onChange={(e) => setNotes((x) => ({ ...x, [v.id]: { ...x[v.id], ar: e.target.value } }))} /></label>
          <label>Review note shown in the app (English)<textarea disabled={!reviewer} value={notes[v.id]?.en ?? ''} onChange={(e) => setNotes((x) => ({ ...x, [v.id]: { ...x[v.id], en: e.target.value } }))} /></label>
          {reviewer ? (
            <div className="actions">
              <button onClick={() => saveNote(v.id)}>Save note</button>
              <button className="publish" onClick={() => markReviewed(v.id)}>Mark as checked</button>
            </div>
          ) : null}
        </div>
      ))}
      {msg ? <p className="ok">{msg}</p> : null}
      <h2>Doses</h2>
      <table>
        <thead><tr><th>Age (months)</th><th>Vaccine</th><th>Dose</th><th>Only for</th></tr></thead>
        <tbody>
          {doses.map((d) => (
            <tr key={d.id}><td>{d.age_months}</td><td>{d.name_en} ({d.vaccine_code})</td><td>{d.dose_label_en}</td><td>{d.only_gender ?? '—'}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
