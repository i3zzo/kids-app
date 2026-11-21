'use client';
// Overview: what is waiting for review, per content type.
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useStaff } from '@/components/Shell';
import { canPublish, CONTENT } from '@/lib/content';
import { supabase } from '@/lib/supabase';

export default function Overview() {
  const { role } = useStaff();
  const [counts, setCounts] = useState<Record<string, { review: number; draft: number }>>({});

  useEffect(() => {
    // One small count request per type, all sent together.
    Promise.all(
      Object.values(CONTENT).map(async (ct) => {
        const [r, d] = await Promise.all([
          supabase.from(ct.table).select('id', { count: 'exact', head: true }).eq('status', 'in_review'),
          supabase.from(ct.table).select('id', { count: 'exact', head: true }).eq('status', 'draft'),
        ]);
        return [ct.key, { review: r.count ?? 0, draft: d.count ?? 0 }] as const;
      }),
    ).then((pairs) => setCounts(Object.fromEntries(pairs)));
  }, []);

  return (
    <div>
      <h1>Overview</h1>
      <p className="hint">Content goes draft → in review → published. Directory, offers, guides and brands: any team member can publish. Suggested supplies (health content): only a health reviewer.</p>
      <table>
        <thead><tr><th>Content</th><th>Waiting for review</th><th>Drafts</th><th>You can publish</th></tr></thead>
        <tbody>
          {Object.values(CONTENT).map((ct) => (
            <tr key={ct.key}>
              <td><Link href={`/${ct.key}/`}>{ct.title}</Link></td>
              <td>{counts[ct.key]?.review ?? '…'}</td>
              <td>{counts[ct.key]?.draft ?? '…'}</td>
              <td>{canPublish(role, ct.kind) ? 'Yes' : 'No (health reviewer)'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
