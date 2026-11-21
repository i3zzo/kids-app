// Which government guides fit a child. Kuwaiti families see the Kuwaiti and
// the general guides; resident families (GCC or other nationality) see the
// resident and the general ones. If the nationality group isn't set, all show.
export type Audience = 'kuwaiti' | 'resident' | 'all';
export type NationalityGroup = 'kuwaiti' | 'gcc' | 'other';

export function guideFits(audience: Audience, nationality: NationalityGroup | null | undefined): boolean {
  if (!nationality || audience === 'all') return true;
  return nationality === 'kuwaiti' ? audience === 'kuwaiti' : audience === 'resident';
}
