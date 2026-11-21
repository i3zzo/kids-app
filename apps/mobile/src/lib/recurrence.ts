// Repeating events: the database stores each event once (its first date plus
// "repeat weekly until …"), and the calendar works out the dates to show.
// The same rule runs in the database for reminders (next_occurrence in
// supabase/migrations/20261121140000_reminders.sql): monthly events on the
// 29th–31st fall on the last day of shorter months.
import type { Repeat } from './api';

function addMonthsClamped(start: Date, n: number): Date {
  const d = new Date(start);
  const day = start.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return d;
}

function nth(start: Date, rep: Repeat, k: number): Date {
  if (rep === 'monthly') return addMonthsClamped(start, k);
  const d = new Date(start);
  d.setDate(d.getDate() + k * (rep === 'daily' ? 1 : 7));
  return d;
}

/** Start times of an event that fall in [from, to). `until` is a "YYYY-MM-DD" day, inclusive. */
export function occurrencesBetween(startsAt: string, rep: Repeat, until: string | null, from: Date, to: Date): Date[] {
  const start = new Date(startsAt);
  if (rep === 'none') return start >= from && start < to ? [start] : [];
  const end = until ? new Date(`${until}T23:59:59.999`) : null;
  // Jump close to `from` instead of walking from the first date.
  let k = 0;
  if (start < from) {
    const days = (from.getTime() - start.getTime()) / 86_400_000;
    k = rep === 'daily' ? Math.floor(days) : rep === 'weekly' ? Math.floor(days / 7) : Math.max(0, Math.floor(days / 31));
  }
  const out: Date[] = [];
  for (let guard = 0; guard < 500; guard++, k++) {
    const occ = nth(start, rep, k);
    if (occ >= to || (end && occ > end)) break;
    if (occ >= from) out.push(occ);
  }
  return out;
}

/**
 * Turn events (one-off and repeating) into the list to show between two
 * times: one entry per occurrence, with starts_at set to that occurrence and
 * a unique `key`. Sorted by time.
 */
export function expandEvents<E extends { id: string; starts_at: string; repeat: Repeat; repeat_until: string | null }>(
  events: E[],
  from: Date,
  to: Date,
): (E & { key: string })[] {
  const out: (E & { key: string })[] = [];
  for (const e of events) {
    for (const at of occurrencesBetween(e.starts_at, e.repeat, e.repeat_until, from, to)) {
      const iso = at.toISOString();
      out.push({ ...e, starts_at: iso, key: `${e.id}@${iso}` });
    }
  }
  return out.sort((a, b) => (a.starts_at < b.starts_at ? -1 : a.starts_at > b.starts_at ? 1 : 0));
}
