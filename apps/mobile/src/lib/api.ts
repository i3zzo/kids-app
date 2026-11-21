// All database reads and writes in one file, so it's easy to see what the app
// asks for. Each query selects only the columns its screen needs, and related
// data (e.g. the child's name on an event, the vaccine name on a dose) comes in
// the same request through Supabase nested selects — no "one query per row".
import { fetch as streamingFetch } from 'expo/fetch';
import { supabase } from './supabase';
import { tagsForNeed, type PriceUnit, type SpecialNeed } from './places';
import type { TipSection } from './tips';
export type { PriceUnit };

export const PRIVACY_VERSION = 'privacy-2026-11-draft';

export type Gender = 'girl' | 'boy';
export type NationalityGroup = 'kuwaiti' | 'gcc' | 'other';
export type EventKind = 'activity' | 'training' | 'class' | 'appointment' | 'therapy' | 'other';
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

// ---------------------------------------------------------------- special needs
// Optional and private: only the child's own family can read it (RLS), it is
// never sent to the AI, and it is in the data export. Deleting the child
// deletes it.
export const NEEDS = [
  'autism', 'adhd', 'speech', 'hearing', 'visual', 'physical', 'learning',
  'down_syndrome', 'developmental_delay', 'chronic', 'other',
] as const;
export type Need = (typeof NEEDS)[number];
export type ChildSupport = { needs: Need[]; notes: string | null; has_pada_card: boolean | null };
export type ChildSupportRow = ChildSupport & { child_id: string };
export const EMPTY_SUPPORT: ChildSupport = { needs: [], notes: null, has_pada_card: null };

export async function getChildSupport(childId: string) {
  const row = check(
    await supabase.from('child_support').select('needs, notes, has_pada_card').eq('child_id', childId).maybeSingle(),
  ) as ChildSupport | null;
  return row ?? EMPTY_SUPPORT;
}
/** Every child's support profile in the family (only children that have one). */
export async function listChildSupport() {
  return check(await supabase.from('child_support').select('child_id, needs, notes, has_pada_card')) as ChildSupportRow[];
}
/** Saves the profile, or removes it when everything is empty (one server call). */
export async function saveChildSupport(childId: string, s: ChildSupport) {
  check(
    await supabase.rpc('save_child_support', {
      p_child: childId,
      p_needs: s.needs,
      p_notes: s.notes ?? '',
      p_has_pada_card: s.has_pada_card,
    }),
  );
}
/** PostgREST filter: content for every child, plus content for any of these needs. */
function needsFilter(needs: Need[]) {
  return needs.length ? `for_needs.eq.{},for_needs.ov.{${needs.join(',')}}` : 'for_needs.eq.{}';
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
/** Suggested items for a child's age (in months), gender and needs. Small public list. */
export async function listSuggestions(ageMonths: number, gender: Gender, needs: Need[] = []) {
  return check(
    await supabase
      .from('supply_suggestions')
      .select('id, category, name_ar, name_en, hint_ar, hint_en, brand_kind, is_formula, default_unit, default_low')
      .lte('min_age_months', ageMonths)
      .gte('max_age_months', ageMonths)
      .or(`only_gender.is.null,only_gender.eq.${gender}`)
      .or(needsFilter(needs))
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

// ---------------------------------------------------------------- explore
export type GuideAudience = 'kuwaiti' | 'resident' | 'all';
export type Guide = {
  id: string;
  topic: string;
  audience: GuideAudience;
  title_ar: string;
  title_en: string;
  summary_ar: string;
  summary_en: string;
  source_url: string | null;
  last_verified_on: string | null;
};
export type GuideStep = {
  id: string;
  position: number;
  title_ar: string;
  title_en: string;
  body_ar: string;
  body_en: string;
  documents_ar: string[];
  documents_en: string[];
  link_url: string | null;
};
const GUIDE_COLS = 'id, topic, audience, title_ar, title_en, summary_ar, summary_en, source_url, last_verified_on';

export async function listGuides() {
  return check(await supabase.from('guides').select(GUIDE_COLS).order('sort_order')) as Guide[];
}
/** A guide with its steps, in one request (nested select). */
export async function getGuide(id: string) {
  return check(
    await supabase
      .from('guides')
      .select(`${GUIDE_COLS}, guide_steps(id, position, title_ar, title_en, body_ar, body_en, documents_ar, documents_en, link_url)`)
      .eq('id', id)
      .order('position', { referencedTable: 'guide_steps' })
      .single(),
  ) as Guide & { guide_steps: GuideStep[] };
}
/** Steps this child has done (ids). */
export async function listGuideProgress(childId: string) {
  const rows = check(await supabase.from('guide_progress').select('step_id').eq('child_id', childId)) as { step_id: string }[];
  return new Set(rows.map((r) => r.step_id));
}
export async function setGuideStepDone(familyId: string, childId: string, stepId: string, done: boolean) {
  if (done) check(await supabase.from('guide_progress').upsert({ family_id: familyId, child_id: childId, step_id: stepId }, { ignoreDuplicates: true }));
  else check(await supabase.from('guide_progress').delete().eq('child_id', childId).eq('step_id', stepId));
}

export type PlaceCategory = 'medical_centre' | 'activity' | 'nursery' | 'school' | 'hospital' | 'paediatrician' | 'therapy_centre' | 'support_service' | 'toy_store' | 'clothing_store';
export const PLACE_CATEGORIES: PlaceCategory[] = ['hospital', 'medical_centre', 'paediatrician', 'therapy_centre', 'support_service', 'nursery', 'school', 'activity', 'toy_store', 'clothing_store'];
export type Governorate = 'capital' | 'hawalli' | 'farwaniya' | 'mubarak_al_kabeer' | 'ahmadi' | 'jahra';
export const GOVERNORATES: Governorate[] = ['capital', 'hawalli', 'farwaniya', 'mubarak_al_kabeer', 'ahmadi', 'jahra'];
export type Place = {
  id: string;
  category: PlaceCategory;
  name_ar: string;
  name_en: string;
  governorate: Governorate;
  area_ar: string | null;
  area_en: string | null;
  description_ar: string | null;
  description_en: string | null;
  phone: string | null;
  whatsapp: string | null;
  instagram: string | null;
  website: string | null;
  maps_url: string | null;
  hours_ar: string | null;
  hours_en: string | null;
  verified_on: string | null;
  address: string | null;
  price_min_kwd: number | null;
  price_max_kwd: number | null;
  price_unit: PriceUnit | null;
  price_note_ar: string | null;
  price_note_en: string | null;
  source_checked_on: string | null;
  special_needs_services: SpecialNeed[];
  special_needs_note_ar: string | null;
  special_needs_note_en: string | null;
};
export const PLACES_PAGE = 20;

/** One page of the directory. Uses the (category, governorate, name) index, or (category, name) for all governorates. */
export async function listPlaces(opts: { category: PlaceCategory; governorate: Governorate | null; search: string; page: number; need?: SpecialNeed | 'any' | null }) {
  let q = supabase
    .from('places')
    .select('id, category, name_ar, name_en, governorate, area_ar, area_en, description_ar, description_en, phone, whatsapp, instagram, website, maps_url, hours_ar, hours_en, verified_on, address, price_min_kwd, price_max_kwd, price_unit, price_note_ar, price_note_en, source_checked_on, special_needs_services, special_needs_note_ar, special_needs_note_en')
    .eq('category', opts.category);
  // 'any' = places with any special-needs tag; a need = places tagged with it (or with "all disabilities").
  if (opts.need === 'any') q = q.neq('special_needs_services', '{}');
  else if (opts.need) q = q.overlaps('special_needs_services', tagsForNeed(opts.need));
  if (opts.governorate) q = q.eq('governorate', opts.governorate);
  const s = opts.search.trim().replace(/[%_,()*]/g, ' ').slice(0, 40);
  if (s) q = q.or(`name_ar.ilike.*${s}*,name_en.ilike.*${s}*`);
  const from = opts.page * PLACES_PAGE;
  return check(await q.order('name_en').order('id').range(from, from + PLACES_PAGE - 1)) as Place[];
}

export type Offer = {
  id: string;
  category: 'toys' | 'clothing';
  title_ar: string;
  title_en: string;
  store_ar: string;
  store_en: string;
  details_ar: string | null;
  details_en: string | null;
  min_age_months: number;
  max_age_months: number;
  only_gender: Gender | null;
  ends_on: string;
  url: string | null;
};
/** Current offers, optionally for one child's age and gender. */
export async function listOffers(todayDay: string, forChild?: { ageMonths: number; gender: Gender }) {
  let q = supabase
    .from('offers')
    .select('id, category, title_ar, title_en, store_ar, store_en, details_ar, details_en, min_age_months, max_age_months, only_gender, ends_on, url')
    .gte('ends_on', todayDay)
    .lte('starts_on', todayDay);
  if (forChild) {
    q = q.lte('min_age_months', forChild.ageMonths).gte('max_age_months', forChild.ageMonths).or(`only_gender.is.null,only_gender.eq.${forChild.gender}`);
  }
  return check(await q.order('ends_on').order('id').limit(50)) as Offer[];
}

// ---------------------------------------------------------------- events and trending places
export type KidsEvent = {
  id: string;
  title_ar: string;
  title_en: string;
  venue_ar: string | null;
  venue_en: string | null;
  governorate: Governorate | null;
  area_ar: string | null;
  area_en: string | null;
  description_ar: string | null;
  description_en: string | null;
  starts_on: string;
  ends_on: string;
  hours_ar: string | null;
  hours_en: string | null;
  price_min_kwd: number | null;
  price_max_kwd: number | null;
  price_note_ar: string | null;
  price_note_en: string | null;
  url: string | null;
  source_checked_on: string;
  verified_on: string | null;
};
export const EVENTS_PAGE = 20;
/** Events that haven't ended, soonest first. Uses the partial (ends_on, starts_on, id) index. */
export async function listKidsEvents(todayDay: string, page = 0) {
  const from = page * EVENTS_PAGE;
  return check(
    await supabase
      .from('kids_events')
      .select('id, title_ar, title_en, venue_ar, venue_en, governorate, area_ar, area_en, description_ar, description_en, starts_on, ends_on, hours_ar, hours_en, price_min_kwd, price_max_kwd, price_note_ar, price_note_en, url, source_checked_on, verified_on')
      .gte('ends_on', todayDay)
      .order('ends_on')
      .order('starts_on')
      .order('id')
      .range(from, from + EVENTS_PAGE - 1),
  ) as KidsEvent[];
}
export type TrendingPlace = Pick<Place, 'id' | 'category' | 'name_ar' | 'name_en' | 'governorate' | 'area_ar' | 'area_en'> & {
  trending_note_ar: string | null;
  trending_note_en: string | null;
};
/** Places the team marks as new or trending, while the mark lasts. */
export async function listTrendingPlaces(todayDay: string) {
  return check(
    await supabase
      .from('places')
      .select('id, category, name_ar, name_en, governorate, area_ar, area_en, trending_note_ar, trending_note_en')
      .gte('trending_until', todayDay)
      .order('trending_until')
      .order('id')
      .limit(20),
  ) as TrendingPlace[];
}

// ---------------------------------------------------------------- tips
export type Tip = {
  id: string;
  section: TipSection;
  title_ar: string;
  title_en: string;
  body_ar: string;
  body_en: string;
};
/** Reviewed tips for a child's age (in months) and gender. Small public list. */
export async function listTips(ageMonths: number, gender: Gender, needs: Need[] = []) {
  return check(
    await supabase
      .from('tips')
      .select('id, section, title_ar, title_en, body_ar, body_en')
      .lte('min_age_months', ageMonths)
      .gte('max_age_months', ageMonths)
      .or(`only_gender.is.null,only_gender.eq.${gender}`)
      .or(needsFilter(needs))
      .order('sort_order'),
  ) as Tip[];
}

export type ChildTip = Tip & { child_id: string };
/** Tips that fit each of the family's children, in one request (Home's tip of the day). */
export async function listMyChildrenTips() {
  return check(await supabase.rpc('my_children_tips')) as ChildTip[];
}

export type AiError = 'daily_limit' | 'not_configured' | 'failed';
/**
 * Asks the server to personalise one section of tips for a child, and passes
 * the answer to onText piece by piece as it arrives. The server sends the AI
 * only the child's age in months and gender. Throws an Error whose message is
 * an AiError.
 */
export async function streamTipsAI(childId: string, section: TipSection, lang: 'ar' | 'en', onText: (all: string) => void, signal?: AbortSignal) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('failed');
  let res: Response;
  try {
    res = (await streamingFetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/tips-ai`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '', 'Content-Type': 'application/json' },
      body: JSON.stringify({ child_id: childId, section, lang }),
      signal,
    })) as unknown as Response;
  } catch {
    throw new Error('failed');
  }
  if (res.status === 429) throw new Error('daily_limit');
  if (res.status === 503) throw new Error('not_configured');
  if (!res.ok || !res.body) throw new Error('failed');
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let all = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    all += decoder.decode(value, { stream: true });
    onText(all);
  }
  all += decoder.decode();
  if (!all.trim()) throw new Error('failed');
  onText(all);
}

// ---------------------------------------------------------------- privacy
/** Everything Yahal holds about this parent and their family, as one object. */
export async function exportMyData() {
  return check(await supabase.rpc('export_my_data')) as Record<string, unknown>;
}
/** Permanently deletes this parent's account (and, for the owner, the whole family). */
export async function deleteMyAccount() {
  check(await supabase.rpc('delete_my_account', { confirm: 'DELETE' }));
}
