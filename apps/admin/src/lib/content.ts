// What each content type looks like in the admin panel: its table, the columns
// in the list, and the fields in the form. The database checks every value
// again (constraints and triggers), so these are for convenience only.
import type { StaffRole } from './supabase';

export type FieldType = 'text' | 'textarea' | 'number' | 'date' | 'url' | 'select' | 'lines';
export type Field = { key: string; label: string; type: FieldType; options?: string[]; required?: boolean; dir?: 'rtl' | 'ltr'; step?: string };
export type ContentType = {
  key: string;
  table: string;
  title: string;
  /** 'health' content can only be published by a health reviewer */
  kind: 'health' | 'general';
  listColumns: string[];
  searchColumns: string[];
  order: string;
  fields: Field[];
  defaults: Record<string, unknown>;
  hint?: string;
};

const ar = (key: string, label: string, type: FieldType = 'text', required = true): Field => ({ key, label, type, required, dir: 'rtl' });
const en = (key: string, label: string, type: FieldType = 'text', required = true): Field => ({ key, label, type, required, dir: 'ltr' });
const AGE = [
  { key: 'min_age_months', label: 'Min age (months)', type: 'number' as const, required: true },
  { key: 'max_age_months', label: 'Max age (months)', type: 'number' as const, required: true },
];

export const CONTENT: Record<string, ContentType> = {
  places: {
    key: 'places',
    table: 'places',
    title: 'Directory',
    kind: 'general',
    listColumns: ['name_en', 'category', 'governorate', 'price_min_kwd', 'verified_on'],
    searchColumns: ['name_en', 'name_ar'],
    order: 'name_en',
    hint: 'Set "Verified on" only after calling or visiting the place. Phones are +965 and 8 digits. Enter a price only if a source shows it, with the source link and the date you checked; leave it empty when it isn\'t published.',
    fields: [
      { key: 'category', label: 'Category', type: 'select', options: ['activity', 'nursery', 'school', 'hospital', 'medical_centre', 'paediatrician', 'toy_store', 'clothing_store'], required: true },
      ar('name_ar', 'Name (Arabic)'),
      en('name_en', 'Name (English)'),
      { key: 'governorate', label: 'Governorate', type: 'select', options: ['capital', 'hawalli', 'farwaniya', 'mubarak_al_kabeer', 'ahmadi', 'jahra'], required: true },
      ar('area_ar', 'Area (Arabic)', 'text', false),
      en('area_en', 'Area (English)', 'text', false),
      en('address', 'Address', 'text', false),
      ar('description_ar', 'Description (Arabic)', 'textarea', false),
      en('description_en', 'Description (English)', 'textarea', false),
      ...AGE,
      { key: 'phone', label: 'Phone (+965XXXXXXXX)', type: 'text' },
      { key: 'whatsapp', label: 'WhatsApp (+965XXXXXXXX)', type: 'text' },
      { key: 'instagram', label: 'Instagram username', type: 'text' },
      { key: 'website', label: 'Website (https://)', type: 'url' },
      { key: 'maps_url', label: 'Map link (https://)', type: 'url' },
      ar('hours_ar', 'Hours (Arabic)', 'text', false),
      en('hours_en', 'Hours (English)', 'text', false),
      { key: 'price_min_kwd', label: 'Price from (KD)', type: 'number', step: 'any' },
      { key: 'price_max_kwd', label: 'Price to (KD, if a range)', type: 'number', step: 'any' },
      { key: 'price_unit', label: 'Price is per', type: 'select', options: ['', 'visit', 'entry', 'hour', 'month', 'year'] },
      ar('price_note_ar', 'Price note (Arabic)', 'text', false),
      en('price_note_en', 'Price note (English)', 'text', false),
      { key: 'source_url', label: 'Source (https://)', type: 'url' },
      { key: 'source_checked_on', label: 'Source checked on', type: 'date' },
      { key: 'verified_on', label: 'Verified on', type: 'date' },
    ],
    defaults: { category: 'nursery', governorate: 'capital', min_age_months: 0, max_age_months: 131 },
  },
  offers: {
    key: 'offers',
    table: 'offers',
    title: 'Offers',
    kind: 'general',
    listColumns: ['title_en', 'store_en', 'category', 'ends_on'],
    searchColumns: ['title_en', 'title_ar', 'store_en'],
    order: 'ends_on',
    hint: 'Toys and kids\' clothing only. Formula and other breast-milk substitutes are never allowed.',
    fields: [
      { key: 'category', label: 'Category', type: 'select', options: ['toys', 'clothing'], required: true },
      ar('title_ar', 'Title (Arabic)'),
      en('title_en', 'Title (English)'),
      ar('store_ar', 'Store (Arabic)'),
      en('store_en', 'Store (English)'),
      ar('details_ar', 'Details (Arabic)', 'textarea', false),
      en('details_en', 'Details (English)', 'textarea', false),
      ...AGE,
      { key: 'only_gender', label: 'Only for', type: 'select', options: ['', 'girl', 'boy'] },
      { key: 'starts_on', label: 'Starts on', type: 'date', required: true },
      { key: 'ends_on', label: 'Ends on', type: 'date', required: true },
      { key: 'url', label: 'Link (https://)', type: 'url' },
    ],
    defaults: { category: 'toys', min_age_months: 0, max_age_months: 131 },
  },
  guides: {
    key: 'guides',
    table: 'guides',
    title: 'Government guides',
    kind: 'general',
    listColumns: ['title_en', 'audience', 'topic', 'last_verified_on'],
    searchColumns: ['title_en', 'title_ar'],
    order: 'sort_order',
    hint: 'Set "Last verified on" only after checking every step against the official source. The app shows a warning until then.',
    fields: [
      { key: 'slug', label: 'Slug (a-z, 0-9, -)', type: 'text', required: true },
      { key: 'topic', label: 'Topic', type: 'select', options: ['birth', 'civil_id', 'passport', 'residency', 'health', 'education', 'travel'], required: true },
      { key: 'audience', label: 'For', type: 'select', options: ['all', 'kuwaiti', 'resident'], required: true },
      ar('title_ar', 'Title (Arabic)'),
      en('title_en', 'Title (English)'),
      ar('summary_ar', 'Summary (Arabic)', 'textarea'),
      en('summary_en', 'Summary (English)', 'textarea'),
      { key: 'source_url', label: 'Official source (https://)', type: 'url' },
      { key: 'last_verified_on', label: 'Last verified on', type: 'date' },
      { key: 'sort_order', label: 'Order', type: 'number', required: true },
    ],
    defaults: { topic: 'birth', audience: 'all', sort_order: 100 },
  },
  brands: {
    key: 'brands',
    table: 'brands',
    title: 'Brands',
    kind: 'general',
    listColumns: ['name_en', 'kind', 'needs_store_check'],
    searchColumns: ['name_en', 'name_ar'],
    order: 'name_en',
    hint: 'Only brands sold in Kuwait\'s big supermarkets. They are shown alphabetically, never ranked.',
    fields: [
      { key: 'kind', label: 'Kind', type: 'select', options: ['diapers', 'formula', 'wipes', 'baby_care'], required: true },
      ar('name_ar', 'Name (Arabic)'),
      en('name_en', 'Name (English)'),
      { key: 'needs_store_check', label: 'Needs store check', type: 'select', options: ['true', 'false'], required: true },
    ],
    defaults: { kind: 'diapers', needs_store_check: true },
  },
  suggestions: {
    key: 'suggestions',
    table: 'supply_suggestions',
    title: 'Suggested supplies',
    kind: 'health',
    listColumns: ['name_en', 'category', 'min_age_months', 'max_age_months', 'only_gender'],
    searchColumns: ['name_en', 'name_ar'],
    order: 'sort_order',
    hint: 'Health content: only a health reviewer can publish. Gender only for clothing, feeding and diapering.',
    fields: [
      { key: 'category', label: 'Category', type: 'select', options: ['feeding', 'diapering', 'health', 'teething', 'play', 'clothing'], required: true },
      ar('name_ar', 'Name (Arabic)'),
      en('name_en', 'Name (English)'),
      ar('hint_ar', 'Hint (Arabic)', 'textarea', false),
      en('hint_en', 'Hint (English)', 'textarea', false),
      ...AGE,
      { key: 'only_gender', label: 'Only for', type: 'select', options: ['', 'girl', 'boy'] },
      { key: 'brand_kind', label: 'Show brands of kind', type: 'select', options: ['', 'diapers', 'formula', 'wipes', 'baby_care'] },
      { key: 'is_formula', label: 'Is infant formula', type: 'select', options: ['false', 'true'], required: true },
      { key: 'default_unit', label: 'Unit', type: 'select', options: ['pcs', 'packs', 'boxes', 'bottles', 'tins'], required: true },
      { key: 'default_low', label: 'Default "low" level', type: 'number', required: true },
      { key: 'sort_order', label: 'Order', type: 'number', required: true },
    ],
    defaults: { category: 'health', min_age_months: 0, max_age_months: 131, is_formula: false, default_unit: 'pcs', default_low: 1, sort_order: 100 },
  },
  tips: {
    key: 'tips',
    table: 'tips',
    title: 'Tips library',
    kind: 'health',
    listColumns: ['title_en', 'section', 'min_age_months', 'max_age_months', 'only_gender'],
    searchColumns: ['title_en', 'title_ar'],
    order: 'min_age_months',
    hint: 'Health content: only a health reviewer can publish. The AI may only rephrase published tips, so every word it uses starts here.',
    fields: [
      { key: 'section', label: 'Section', type: 'select', options: ['sleep', 'feeding', 'activities', 'learning', 'health'], required: true },
      ...AGE,
      { key: 'only_gender', label: 'Only for', type: 'select', options: ['', 'girl', 'boy'] },
      ar('title_ar', 'Title (Arabic)'),
      en('title_en', 'Title (English)'),
      ar('body_ar', 'Tip (Arabic)', 'textarea'),
      en('body_en', 'Tip (English)', 'textarea'),
      { key: 'source', label: 'Source', type: 'text' },
      { key: 'sort_order', label: 'Order', type: 'number', required: true },
    ],
    defaults: { section: 'sleep', min_age_months: 0, max_age_months: 131, sort_order: 100 },
  },
};

export const STEP_FIELDS: Field[] = [
  { key: 'position', label: 'Step number', type: 'number', required: true },
  ar('title_ar', 'Title (Arabic)'),
  en('title_en', 'Title (English)'),
  ar('body_ar', 'Text (Arabic)', 'textarea'),
  en('body_en', 'Text (English)', 'textarea'),
  { key: 'documents_ar', label: 'Documents (Arabic, one per line)', type: 'lines', dir: 'rtl' },
  { key: 'documents_en', label: 'Documents (English, one per line)', type: 'lines', dir: 'ltr' },
  { key: 'link_url', label: 'Link (https://)', type: 'url' },
];

/** Whether a role may publish this kind of content (the database enforces the same rule). */
export function canPublish(role: StaffRole | null, kind: 'health' | 'general') {
  if (!role) return false;
  return kind === 'health' ? role === 'health_reviewer' : true;
}

/** Turn form strings into database values. */
export function toRow(fields: Field[], values: Record<string, string>) {
  const row: Record<string, unknown> = {};
  for (const f of fields) {
    const v = (values[f.key] ?? '').trim();
    if (f.type === 'number') row[f.key] = v === '' ? null : Number(v);
    else if (f.type === 'lines') row[f.key] = v.split('\n').map((x) => x.trim()).filter(Boolean);
    else if (v === 'true' || v === 'false') row[f.key] = v === 'true';
    else row[f.key] = v === '' ? null : v;
  }
  return row;
}
export function toForm(fields: Field[], row: Record<string, unknown>) {
  const out: Record<string, string> = {};
  for (const f of fields) {
    const v = row[f.key];
    out[f.key] = v == null ? '' : Array.isArray(v) ? v.join('\n') : String(v);
  }
  return out;
}
