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
export type Repeat = 'none' | 'daily' | 'weekly' | 'monthly';

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
  repeat: Repeat;
  /** last day the event repeats ("YYYY-MM-DD"), inclusive; null = no end */
  repeat_until: string | null;
  /** null = no reminder */
  remind_minutes_before: number | null;
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
const EVENT_COLS = 'id, child_id, kind, title, starts_at, ends_at, all_day, location, notes, repeat, repeat_until, remind_minutes_before';

/**
 * Events that start in [from, to), plus repeating events that began before
 * `to` (the screen works out their dates with lib/recurrence). Two requests,
 * sent together; each uses its own index.
 */
export async function listEvents(familyId: string, from: Date, to: Date) {
  const [oneOff, repeating] = await Promise.all([
    supabase
      .from('events')
      .select(EVENT_COLS)
      .eq('family_id', familyId)
      .eq('repeat', 'none')
      .gte('starts_at', from.toISOString())
      .lt('starts_at', to.toISOString())
      .order('starts_at')
      .order('id'),
    supabase
      .from('events')
      .select(EVENT_COLS)
      .eq('family_id', familyId)
      .neq('repeat', 'none')
      .lt('starts_at', to.toISOString())
      .or(`repeat_until.is.null,repeat_until.gte.${from.toISOString().slice(0, 10)}`)
      .order('starts_at')
      .limit(200),
  ]);
  return [...(check(oneOff) as CalendarEvent[]), ...(check(repeating) as CalendarEvent[])];
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

// ---------------------------------------------------------------- notifications
export type NotificationSettings = {
  vaccines: boolean;
  events: boolean;
  supplies: boolean;
  vaccine_days_before: number;
  quiet_start: string; // "22:00:00"
  quiet_end: string;
};
export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  vaccines: true,
  events: true,
  supplies: true,
  vaccine_days_before: 3,
  quiet_start: '22:00:00',
  quiet_end: '07:00:00',
};

export async function getNotificationSettings() {
  const row = check(
    await supabase.from('notification_settings').select('vaccines, events, supplies, vaccine_days_before, quiet_start, quiet_end').maybeSingle(),
  ) as NotificationSettings | null;
  return row ?? DEFAULT_NOTIFICATION_SETTINGS;
}
export async function saveNotificationSettings(userId: string, s: NotificationSettings) {
  check(await supabase.from('notification_settings').upsert({ user_id: userId, ...s }));
}
export async function registerDevice(token: string, platform: 'ios' | 'android', locale: 'ar' | 'en') {
  check(await supabase.rpc('register_device', { push_token: token, device_platform: platform, device_locale: locale }));
}
export async function unregisterDevice(token: string) {
  check(await supabase.from('device_tokens').delete().eq('token', token));
}

// ---------------------------------------------------------------- supplies
export type SupplyCategory = 'feeding' | 'diapering' | 'health' | 'teething' | 'play' | 'clothing';
export type SupplyUnit = 'pcs' | 'packs' | 'boxes' | 'bottles' | 'tins';
export const SUPPLY_CATEGORIES: SupplyCategory[] = ['feeding', 'diapering', 'health', 'teething', 'play', 'clothing'];
export const SUPPLY_UNITS: SupplyUnit[] = ['pcs', 'packs', 'boxes', 'bottles', 'tins'];

export type SupplyItem = {
  id: string;
  child_id: string;
  category: SupplyCategory;
  name: string;
  brand: string | null;
  size: string | null;
  quantity: number;
  unit: SupplyUnit;
  low_threshold: number;
  is_low: boolean;
  suggestion_id: string | null;
};
export type SupplyInput = Omit<SupplyItem, 'id' | 'is_low' | 'child_id' | 'suggestion_id'>;

export type BrandKind = 'diapers' | 'formula' | 'wipes' | 'baby_care';
export type Brand = { id: string; kind: BrandKind; name_ar: string; name_en: string; needs_store_check: boolean };
export type SupplySuggestion = {
  id: string;
  category: SupplyCategory;
  name_ar: string;
  name_en: string;
  hint_ar: string | null;
  hint_en: string | null;
  brand_kind: BrandKind | null;
  is_formula: boolean;
  default_unit: SupplyUnit;
  default_low: number;
};

const SUPPLY_COLS = 'id, child_id, category, name, brand, size, quantity, unit, low_threshold, is_low, suggestion_id';

/** One child's supplies. Uses the (child_id, category, name) index. */
export async function listSupplies(childId: string) {
  return check(await supabase.from('supply_items').select(SUPPLY_COLS).eq('child_id', childId).order('category').order('name')) as SupplyItem[];
}
/** Items running low across the family, for Home. Uses the partial "is_low" index. */
export async function listLowSupplies(familyId: string, limit = 20) {
  return check(
    await supabase.from('supply_items').select(SUPPLY_COLS).eq('family_id', familyId).eq('is_low', true).order('quantity').order('id').limit(limit),
  ) as SupplyItem[];
}
export async function getSupply(id: string) {
  return check(await supabase.from('supply_items').select(SUPPLY_COLS).eq('id', id).single()) as SupplyItem;
}
export async function addSupply(familyId: string, childId: string, s: SupplyInput, suggestionId: string | null = null) {
  check(await supabase.from('supply_items').insert({ ...s, family_id: familyId, child_id: childId, suggestion_id: suggestionId }));
}
export async function updateSupply(id: string, s: Partial<SupplyInput>) {
  check(await supabase.from('supply_items').update(s).eq('id', id));
}
export async function deleteSupply(id: string) {
  check(await supabase.from('supply_items').delete().eq('id', id));
}
/** Suggested items for a child's age (in months) and gender. Small public list. */
export async function listSuggestions(ageMonths: number, gender: Gender) {
  return check(
    await supabase
      .from('supply_suggestions')
      .select('id, category, name_ar, name_en, hint_ar, hint_en, brand_kind, is_formula, default_unit, default_low')
      .lte('min_age_months', ageMonths)
      .gte('max_age_months', ageMonths)
      .or(`only_gender.is.null,only_gender.eq.${gender}`)
      .order('sort_order'),
  ) as SupplySuggestion[];
}
/** Brands sold in Kuwait, alphabetical (no ranking). */
export async function listBrands() {
  return check(await supabase.from('brands').select('id, kind, name_ar, name_en, needs_store_check').order('name_en')) as Brand[];
}
/** Add several suggested items in one request (not one request per item). */
export async function addSuggestedSupplies(familyId: string, childId: string, list: (SupplyInput & { suggestion_id: string })[]) {
  if (!list.length) return;
  check(await supabase.from('supply_items').insert(list.map((s) => ({ ...s, family_id: familyId, child_id: childId }))));
}
