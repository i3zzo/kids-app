// All database reads and writes in one file, so it's easy to see what the app
// asks for. Each query selects only the columns its screen needs, and related
// data (e.g. the child's name on an event, the vaccine name on a dose) comes in
// the same request through Supabase nested selects — no "one query per row".
import { supabase } from './supabase';

export const PRIVACY_VERSION = 'privacy-2026-11-draft';

export type Gender = 'girl' | 'boy';
export type NationalityGroup = 'kuwaiti' | 'gcc' | 'other';
export type EventKind = 'activity' | 'training' | 'class' | 'appointment' | 'other';
export type DoseStatus = 'due' | 'done' | 'skipped';

export type Child = {
  id: string;
  first_name: string;
  birth_date: string;
  gender: Gender;
  nationality_group: NationalityGroup | null;
  color: string;
};

export type CalendarEvent = {
  id: string;
  child_id: string | null;
  kind: EventKind;
  title: string;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  location: string | null;
  notes: string | null;
};

export type DoseInfo = {
  vaccine_code: string;
  name_ar: string;
  name_en: string;
  dose_label_ar: string;
  dose_label_en: string;
};

export type ChildVaccination = {
  id: string;
  child_id: string;
  due_date: string;
  status: DoseStatus;
  done_on: string | null;
  clinic: string | null;
  vaccine_doses: DoseInfo;
};

export type ScheduleVersion = { title_ar: string; title_en: string; source_url: string | null; review_note_ar: string | null; review_note_en: string | null };

function check<T>(res: { data: T | null; error: { message: string; code?: string } | null }): T {
  if (res.error) throw Object.assign(new Error(res.error.message), { code: res.error.code });
  return res.data as T;
}

// ---------------------------------------------------------------- family
export async function createFamily(name: string) {
  return check(await supabase.rpc('create_family', { family_name: name, accepted_privacy_version: PRIVACY_VERSION })) as string;
}
/** Returns the family id, or null when the code is wrong or expired. */
export async function acceptInvite(code: string) {
  return check(await supabase.rpc('accept_family_invite', { invite_code: code })) as string | null;
}
export async function createInvite() {
  return check(await supabase.rpc('create_family_invite')) as string;
}
export async function listParents(familyId: string) {
  return check(
    await supabase
      .from('family_members')
      .select('user_id, role, profiles(display_name)')
      .eq('family_id', familyId)
      .order('joined_at'),
  ) as unknown as { user_id: string; role: 'owner' | 'co_parent'; profiles: { display_name: string | null } | null }[];
}

// ---------------------------------------------------------------- children
const CHILD_COLS = 'id, first_name, birth_date, gender, nationality_group, color';

export async function listChildren() {
  return check(await supabase.from('children').select(CHILD_COLS).order('birth_date').order('id')) as Child[];
}
export async function getChild(id: string) {
  return check(await supabase.from('children').select(CHILD_COLS).eq('id', id).single()) as Child;
}
export async function addChild(familyId: string, c: Omit<Child, 'id'>) {
  return check(await supabase.from('children').insert({ ...c, family_id: familyId }).select('id').single()) as { id: string };
}
export async function updateChild(id: string, c: Partial<Omit<Child, 'id'>>) {
  check(await supabase.from('children').update(c).eq('id', id));
}
export async function deleteChild(id: string) {
  check(await supabase.from('children').delete().eq('id', id));
}

// ---------------------------------------------------------------- events
const EVENT_COLS = 'id, child_id, kind, title, starts_at, ends_at, all_day, location, notes';

/** Events whose start is in [from, to). Uses the (family_id, starts_at) index. */
export async function listEvents(familyId: string, from: Date, to: Date) {
  return check(
    await supabase
      .from('events')
      .select(EVENT_COLS)
      .eq('family_id', familyId)
      .gte('starts_at', from.toISOString())
      .lt('starts_at', to.toISOString())
      .order('starts_at')
      .order('id'),
  ) as CalendarEvent[];
}
export async function getEvent(id: string) {
  return check(await supabase.from('events').select(EVENT_COLS).eq('id', id).single()) as CalendarEvent;
}
export async function saveEvent(familyId: string, id: string | null, e: Omit<CalendarEvent, 'id'>) {
  if (id) check(await supabase.from('events').update(e).eq('id', id));
  else check(await supabase.from('events').insert({ ...e, family_id: familyId }));
}
export async function deleteEvent(id: string) {
  check(await supabase.from('events').delete().eq('id', id));
}

// ---------------------------------------------------------------- vaccinations
const VAX_COLS = 'id, child_id, due_date, status, done_on, clinic, vaccine_doses(vaccine_code, name_ar, name_en, dose_label_ar, dose_label_en)';

/** Doses due in [fromDay, toDay]. Uses the (family_id, due_date) index. */
export async function listVaccinationsBetween(familyId: string, fromDay: string, toDay: string) {
  return check(
    await supabase
      .from('child_vaccinations')
      .select(VAX_COLS)
      .eq('family_id', familyId)
      .gte('due_date', fromDay)
      .lte('due_date', toDay)
      .order('due_date')
      .order('id'),
  ) as unknown as ChildVaccination[];
}

/** Not-yet-given doses up to a date (overdue + upcoming), for the Home screen. */
export async function listOpenVaccinations(familyId: string, untilDay: string, limit = 30) {
  return check(
    await supabase
      .from('child_vaccinations')
      .select(VAX_COLS)
      .eq('family_id', familyId)
      .eq('status', 'due')
      .lte('due_date', untilDay)
      .order('due_date')
      .order('id')
      .limit(limit),
  ) as unknown as ChildVaccination[];
}

export async function listChildVaccinations(childId: string) {
  return check(
    await supabase.from('child_vaccinations').select(VAX_COLS).eq('child_id', childId).order('due_date').order('id'),
  ) as unknown as ChildVaccination[];
}
export async function getVaccination(id: string) {
  return check(await supabase.from('child_vaccinations').select(VAX_COLS).eq('id', id).single()) as unknown as ChildVaccination;
}
export async function updateVaccination(id: string, v: Partial<Pick<ChildVaccination, 'due_date' | 'status' | 'done_on' | 'clinic'>>) {
  check(await supabase.from('child_vaccinations').update(v).eq('id', id));
}
/** "My child already had everything due before today." Sets done_on to each dose's due date. */
export async function markPastDosesDone(childId: string, todayDay: string) {
  const past = check(
    await supabase.from('child_vaccinations').select('id, due_date').eq('child_id', childId).eq('status', 'due').lt('due_date', todayDay),
  ) as { id: string; due_date: string }[];
  // Group by date so it's one update per distinct due date (a handful), not per dose.
  const byDate = new Map<string, string[]>();
  for (const p of past) byDate.set(p.due_date, [...(byDate.get(p.due_date) ?? []), p.id]);
  await Promise.all(
    [...byDate].map(async ([day, ids]) =>
      check(await supabase.from('child_vaccinations').update({ status: 'done', done_on: day }).in('id', ids)),
    ),
  );
}
export async function getCurrentSchedule() {
  return check(
    await supabase.from('vaccine_schedule_versions').select('title_ar, title_en, source_url, review_note_ar, review_note_en').eq('is_current', true).maybeSingle(),
  ) as ScheduleVersion | null;
}
