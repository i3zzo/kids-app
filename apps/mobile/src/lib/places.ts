// Display helpers for directory listings. Pure functions so they can be unit tested.
export type PriceUnit = 'visit' | 'entry' | 'hour' | 'month' | 'year';
type PriceFields = { price_min_kwd: number | string | null; price_max_kwd: number | string | null; price_unit: PriceUnit | null };

const UNIT: Record<'ar' | 'en', Record<PriceUnit, string>> = {
  ar: { visit: 'للزيارة', entry: 'للدخول', hour: 'للساعة', month: 'شهرياً', year: 'سنوياً' },
  en: { visit: 'a visit', entry: 'entry', hour: 'an hour', month: 'a month', year: 'a year' },
};

/** "KD 2,400 a year", "KD 0.5–1", or null when the price isn't published. */
export function formatPrice(p: PriceFields, locale: 'ar' | 'en'): string | null {
  if (p.price_min_kwd == null) return null;
  // PostgREST returns numeric columns as numbers or strings depending on size.
  const fmt = (v: number | string) => Number(v).toLocaleString(locale === 'ar' ? 'ar-KW' : 'en-US', { maximumFractionDigits: 3 });
  const amount = p.price_max_kwd != null && Number(p.price_max_kwd) !== Number(p.price_min_kwd)
    ? `${fmt(p.price_min_kwd)}–${fmt(p.price_max_kwd)}`
    : fmt(p.price_min_kwd);
  const money = locale === 'ar' ? `${amount} د.ك` : `KD ${amount}`;
  return p.price_unit ? `${money} ${UNIT[locale][p.price_unit]}` : money;
}

/** The place's own map link, or a Google Maps search for its name and area. */
export function mapLink(p: { maps_url: string | null; name_en: string; area_en: string | null }): string {
  if (p.maps_url) return p.maps_url;
  const q = [p.name_en, p.area_en, 'Kuwait'].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

/** Needs and access tags a directory listing can carry (matches places.special_needs_services). */
export const SPECIAL_NEEDS_SERVICES = [
  'autism', 'adhd', 'speech', 'occupational', 'physio', 'hearing', 'visual', 'learning', 'intellectual',
  'down_syndrome', 'physical', 'developmental_delay', 'early_intervention', 'all_needs', 'general',
  'wheelchair_access', 'sensory_friendly',
] as const;
export type SpecialNeed = (typeof SPECIAL_NEEDS_SERVICES)[number];
/** Tags a parent picks from: "all_needs" and "general" match any specific need, so they aren't offered on their own. */
export const NEED_FILTERS: SpecialNeed[] = SPECIAL_NEEDS_SERVICES.filter((n) => n !== 'all_needs' && n !== 'general');
/** Tags that a place serving this need may carry: the need itself, or "all disabilities". */
export function tagsForNeed(need: SpecialNeed): SpecialNeed[] {
  return need === 'wheelchair_access' || need === 'sensory_friendly' ? [need] : [need, 'all_needs'];
}
