'use client';
import type { Field } from '@/lib/content';

export function Fields({ fields, values, onChange }: { fields: Field[]; values: Record<string, string>; onChange: (k: string, v: string) => void }) {
  return (
    <div className="grid">
      {fields.map((f) => {
        const common = { id: f.key, value: values[f.key] ?? '', dir: f.dir, 'data-testid': `f-${f.key}` };
        const wide = f.type === 'textarea' || f.type === 'lines';
        return (
          <label key={f.key} className={wide ? 'wide' : ''}>
            {f.label}
            {f.required ? ' *' : ''}
            {f.type === 'select' ? (
              <select {...common} onChange={(e) => onChange(f.key, e.target.value)}>
                {(f.options ?? []).map((o) => (
                  <option key={o} value={o}>{o || '—'}</option>
                ))}
              </select>
            ) : wide ? (
              <textarea {...common} rows={f.type === 'lines' ? 4 : 3} onChange={(e) => onChange(f.key, e.target.value)} />
            ) : (
              <input {...common} type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : f.type === 'url' ? 'url' : 'text'} onChange={(e) => onChange(f.key, e.target.value)} />
            )}
          </label>
        );
      })}
    </div>
  );
}
