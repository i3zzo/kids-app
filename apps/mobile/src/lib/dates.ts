// Small date helpers. Dates for children and vaccinations are plain calendar
// days ("2026-11-21"), so we work with local-day strings and avoid time-zone
// surprises.

export function toDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseDay(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function isValidDay(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = parseDay(s);
  return toDay(d) === s;
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/** First and last visible day of a month grid (weeks start on Sunday, as in Kuwait). */
export function monthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const start = addDays(first, -first.getDay());
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) days.push(addDays(start, i));
  return days;
}

/** Age in whole months and years, for labels like "1 year 3 months". */
export function ageParts(birthDay: string, today = new Date()): { years: number; months: number } {
  const b = parseDay(birthDay);
  let months = (today.getFullYear() - b.getFullYear()) * 12 + (today.getMonth() - b.getMonth());
  if (today.getDate() < b.getDate()) months -= 1;
  months = Math.max(0, months);
  return { years: Math.floor(months / 12), months: months % 12 };
}

export function maxBirthAgeDay(today = new Date()): string {
  const d = new Date(today);
  d.setFullYear(d.getFullYear() - 11);
  return toDay(addDays(d, 1));
}

/** "1 year 3 months" / "سنة و3 أشهر", with correct Arabic plural forms. */
export function ageLabel(birthDay: string, locale: 'ar' | 'en', today = new Date()): string {
  const { years, months } = ageParts(birthDay, today);
  if (locale === 'ar') {
    const y = years === 0 ? '' : years === 1 ? 'سنة' : years === 2 ? 'سنتان' : years <= 10 ? `${years} سنوات` : `${years} سنة`;
    const m = months === 0 ? '' : months === 1 ? 'شهر' : months === 2 ? 'شهران' : months <= 10 ? `${months} أشهر` : `${months} شهراً`;
    if (!y && !m) return 'حديث الولادة';
    return [y, m].filter(Boolean).join(' و');
  }
  const y = years === 0 ? '' : `${years} ${years === 1 ? 'year' : 'years'}`;
  const m = months === 0 ? '' : `${months} ${months === 1 ? 'month' : 'months'}`;
  if (!y && !m) return 'Newborn';
  return [y, m].filter(Boolean).join(' ');
}
