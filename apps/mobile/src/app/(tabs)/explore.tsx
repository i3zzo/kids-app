// Explore: government guides, the directory of places, and offers.
// All of it is content our team curates; parents can only read it.
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, View } from 'react-native';
import { Button, Card, Choice, ErrorText, Field, Muted, Row, Screen, Skeleton, Txt } from '@/components/ui';
import {
  GOVERNORATES,
  listChildren,
  listKidsEvents,
  listChildSupport,
  listGuides,
  listTrendingPlaces,
  listOffers,
  listPlaces,
  PLACE_CATEGORIES,
  PLACES_PAGE,
  EVENTS_PAGE,
  type Child,
  type KidsEvent,
  type Governorate,
  type Place,
  type PlaceCategory,
} from '@/lib/api';
import { ageParts, toDay } from '@/lib/dates';
import { guideFits } from '@/lib/guides';
import { formatPrice, mapLink } from '@/lib/places';
import { formatDay, useI18n } from '@/lib/i18n';
import { useLoad } from '@/lib/useLoad';
import { colors, space } from '@/theme';

type Section = 'guides' | 'events' | 'directory' | 'offers';

export default function Explore() {
  const { t } = useI18n();
  const [section, setSection] = useState<Section>('guides');
  const { data: children } = useLoad(listChildren, []);
  return (
    <Screen>
      <Choice
        value={section}
        onChange={setSection}
        options={[
          { value: 'guides', label: t.guides },
          { value: 'events', label: t.events },
          { value: 'directory', label: t.directory },
          { value: 'offers', label: t.offers },
        ]}
      />
      {section === 'guides' ? <Guides children={children} /> : section === 'events' ? <Events /> : section === 'directory' ? <Directory /> : <Offers children={children} />}
    </Screen>
  );
}

function ChildPicker({ children, value, onChange, allowAll }: { children: Child[]; value: string; onChange: (v: string) => void; allowAll?: string }) {
  if (children.length === 0 || (children.length === 1 && !allowAll)) return null;
  return (
    <Choice
      value={value}
      onChange={onChange}
      options={[...(allowAll ? [{ value: 'all', label: allowAll }] : []), ...children.map((c) => ({ value: c.id, label: c.first_name }))]}
    />
  );
}

function Guides({ children }: { children?: Child[] }) {
  const { t, locale } = useI18n();
  const { data, error, reload } = useLoad(() => Promise.all([listGuides(), listChildSupport()]), []);
  const [childId, setChildId] = useState('');
  useEffect(() => {
    if (children?.length && !children.some((c) => c.id === childId)) setChildId(children[0].id);
  }, [children, childId]);
  if (error) return <><ErrorText>{t.somethingWrong}</ErrorText><Button title={t.retry} variant="secondary" onPress={reload} /></>;
  if (!data || !children) return <Skeleton lines={4} />;
  const child = children.find((c) => c.id === childId);
  const audienceLabel = { kuwaiti: t.forKuwaiti, resident: t.forResident, all: t.forAll };
  const [guides, support] = data;
  // For a child with special needs, the disability services guides come first.
  const hasNeeds = support.some((s) => s.child_id === childId && s.needs.length > 0);
  const ordered = hasNeeds ? [...guides].sort((a, b) => Number(b.topic === 'disability') - Number(a.topic === 'disability')) : guides;
  return (
    <>
      <ChildPicker children={children} value={childId} onChange={setChildId} />
      {ordered
        .filter((g) => guideFits(g.audience, child?.nationality_group))
        .map((g) => (
          <Card key={g.id} onPress={() => router.push({ pathname: '/guide/[id]', params: { id: g.id, child: childId } })} testID={`guide-${g.topic}`}>
            <Txt style={{ fontWeight: '700' }}>{locale === 'ar' ? g.title_ar : g.title_en}</Txt>
            <Muted>{locale === 'ar' ? g.summary_ar : g.summary_en}</Muted>
            <Muted style={{ fontSize: 12 }}>{audienceLabel[g.audience]}</Muted>
          </Card>
        ))}
    </>
  );
}

function Directory() {
  const { t, locale } = useI18n();
  const [category, setCategory] = useState<PlaceCategory>('hospital');
  const [gov, setGov] = useState<Governorate | 'all'>('all');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [pages, setPages] = useState<Place[][]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Wait until typing pauses (300 ms) before searching.
  useEffect(() => {
    const h = setTimeout(() => setQuery(search), 300);
    return () => clearTimeout(h);
  }, [search]);

  async function load(page: number) {
    setLoading(true);
    setError(false);
    try {
      const rows = await listPlaces({ category, governorate: gov === 'all' ? null : gov, search: query, page });
      setPages((p) => (page === 0 ? [rows] : [...p, rows]));
      setHasMore(rows.length === PLACES_PAGE);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    setPages([]);
    load(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, gov, query]);

  const places = pages.flat();
  return (
    <>
      <Choice value={category} onChange={setCategory} options={PLACE_CATEGORIES.map((c) => ({ value: c, label: t[`place_${c}`] }))} />
      <Choice
        value={gov}
        onChange={setGov}
        options={[{ value: 'all' as const, label: t.allGovernorates }, ...GOVERNORATES.map((g) => ({ value: g, label: t[`gov_${g}`] }))]}
      />
      <Field label={t.search} placeholder={t.searchPlaces} value={search} onChangeText={setSearch} maxLength={40} testID="place-search" />
      {error ? <><ErrorText>{t.somethingWrong}</ErrorText><Button title={t.retry} variant="secondary" onPress={() => load(0)} /></> : null}
      {places.length === 0 && loading ? <Skeleton lines={3} /> : null}
      {places.length === 0 && !loading && !error ? <Muted>{t.noPlaces}</Muted> : null}
      {places.map((p) => (
        <PlaceCard key={p.id} p={p} />
      ))}
      {hasMore ? <Button title={t.loadMore} variant="secondary" loading={loading && places.length > 0} onPress={() => load(pages.length)} /> : null}
    </>
  );

  function PlaceCard({ p }: { p: Place }) {
    const area = locale === 'ar' ? p.area_ar : p.area_en;
    const desc = locale === 'ar' ? p.description_ar : p.description_en;
    const hours = locale === 'ar' ? p.hours_ar : p.hours_en;
    const price = formatPrice(p, locale);
    const priceNote = locale === 'ar' ? p.price_note_ar : p.price_note_en;
    const actions = [
      p.phone ? { label: t.call, url: `tel:${p.phone}` } : null,
      p.whatsapp ? { label: t.whatsapp, url: `https://wa.me/${p.whatsapp.replace(/\D/g, '')}` } : null,
      { label: t.map, url: mapLink(p) },
      p.website ? { label: t.website, url: p.website } : null,
    ].filter(Boolean) as { label: string; url: string }[];
    return (
      <Card testID={`place-${p.name_en}`}>
        <Txt style={{ fontWeight: '700' }}>{locale === 'ar' ? p.name_ar : p.name_en}</Txt>
        <Muted>{[t[`gov_${p.governorate}`], area].filter(Boolean).join(' · ')}</Muted>
        {desc ? <Txt>{desc}</Txt> : null}
        {p.address ? <Muted>{p.address}</Muted> : null}
        {hours ? <Muted>{hours}</Muted> : null}
        <Txt testID={`price-${p.name_en}`}>{price ?? t.priceNotPublished}</Txt>
        {priceNote ? <Muted style={{ fontSize: 12 }}>{priceNote}</Muted> : null}
        {p.source_checked_on ? <Muted style={{ fontSize: 12 }}>{t.sourceChecked}: {formatDay(p.source_checked_on, locale)}</Muted> : null}
        {!p.verified_on ? <Muted style={{ fontSize: 12, color: colors.warning }}>{t.notConfirmed}</Muted> : null}
        {actions.length ? (
          <Row style={{ flexWrap: 'wrap' }}>
            {actions.map((a) => (
              <View key={a.label} style={{ minWidth: 96, flexGrow: 1 }}>
                <Button title={a.label} variant="secondary" onPress={() => Linking.openURL(a.url)} />
              </View>
            ))}
          </Row>
        ) : null}
      </Card>
    );
  }
}

function Events() {
  const { t, locale } = useI18n();
  const today = toDay(new Date());
  const { data: trending } = useLoad(() => listTrendingPlaces(today), [today]);
  const [pages, setPages] = useState<KidsEvent[][]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  async function load(page: number) {
    setLoading(true);
    setError(false);
    try {
      const rows = await listKidsEvents(today, page);
      setPages((p) => (page === 0 ? [rows] : [...p, rows]));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today]);
  const events = pages.flat();
  const hasMore = pages.length > 0 && pages[pages.length - 1].length === EVENTS_PAGE;
  const range = (e: KidsEvent) => (e.starts_on === e.ends_on ? formatDay(e.starts_on, locale) : `${formatDay(e.starts_on, locale)} – ${formatDay(e.ends_on, locale)}`);
  return (
    <>
      {trending?.length ? (
        <>
          <Txt style={{ fontWeight: '700' }}>{t.trendingPlaces}</Txt>
          {trending.map((p) => (
            <Card key={p.id} testID={`trending-${p.name_en}`}>
              <Txt style={{ fontWeight: '700' }}>{locale === 'ar' ? p.name_ar : p.name_en}</Txt>
              <Muted>{[t[`place_${p.category}`], t[`gov_${p.governorate}`], locale === 'ar' ? p.area_ar : p.area_en].filter(Boolean).join(' · ')}</Muted>
              {(locale === 'ar' ? p.trending_note_ar : p.trending_note_en) ? <Txt>{locale === 'ar' ? p.trending_note_ar : p.trending_note_en}</Txt> : null}
            </Card>
          ))}
        </>
      ) : null}
      <Txt style={{ fontWeight: '700' }}>{t.upcomingEvents}</Txt>
      {error ? <><ErrorText>{t.somethingWrong}</ErrorText><Button title={t.retry} variant="secondary" onPress={() => load(0)} /></> : null}
      {events.length === 0 && loading ? <Skeleton lines={3} /> : null}
      {events.length === 0 && !loading && !error ? <Muted>{t.noEvents}</Muted> : null}
      {events.map((e) => {
        const price = formatPrice({ price_min_kwd: e.price_min_kwd, price_max_kwd: e.price_max_kwd, price_unit: null }, locale);
        const note = locale === 'ar' ? e.price_note_ar : e.price_note_en;
        const where = [locale === 'ar' ? e.venue_ar : e.venue_en, e.governorate ? t[`gov_${e.governorate}`] : null].filter(Boolean).join(' · ');
        return (
          <Card key={e.id} testID={`event-${e.title_en}`} onPress={e.url ? () => Linking.openURL(e.url!) : undefined}>
            <Txt style={{ fontWeight: '700' }}>{locale === 'ar' ? e.title_ar : e.title_en}</Txt>
            <Muted>{range(e)}</Muted>
            {where ? <Muted>{where}</Muted> : null}
            {(locale === 'ar' ? e.description_ar : e.description_en) ? <Txt>{locale === 'ar' ? e.description_ar : e.description_en}</Txt> : null}
            {(locale === 'ar' ? e.hours_ar : e.hours_en) ? <Muted>{locale === 'ar' ? e.hours_ar : e.hours_en}</Muted> : null}
            <Txt>{price ?? t.priceNotPublished}</Txt>
            {note ? <Muted style={{ fontSize: 12 }}>{note}</Muted> : null}
            <Muted style={{ fontSize: 12 }}>{t.sourceChecked}: {formatDay(e.source_checked_on, locale)}</Muted>
            {!e.verified_on ? <Muted style={{ fontSize: 12, color: colors.warning }}>{t.eventNotConfirmed}</Muted> : null}
          </Card>
        );
      })}
      {hasMore ? <Button title={t.loadMore} variant="secondary" loading={loading && events.length > 0} onPress={() => load(pages.length)} /> : null}
    </>
  );
}

function Offers({ children }: { children?: Child[] }) {
  const { t, locale } = useI18n();
  const [childId, setChildId] = useState('all');
  const today = toDay(new Date());
  const child = children?.find((c) => c.id === childId);
  const { data, error, reload } = useLoad(() => {
    if (!child) return listOffers(today);
    const { years, months } = ageParts(child.birth_date);
    return listOffers(today, { ageMonths: years * 12 + months, gender: child.gender });
  }, [childId, children?.length]);
  return (
    <>
      {children ? <ChildPicker children={children} value={childId} onChange={setChildId} allowAll={t.allChildren} /> : null}
      {error ? (
        <><ErrorText>{t.somethingWrong}</ErrorText><Button title={t.retry} variant="secondary" onPress={reload} /></>
      ) : !data ? (
        <Skeleton lines={3} />
      ) : data.length === 0 ? (
        <Muted>{t.noOffers}</Muted>
      ) : (
        data.map((o) => (
          <Card key={o.id} onPress={o.url ? () => Linking.openURL(o.url!) : undefined}>
            <Row>
              <Txt style={{ fontWeight: '700', flex: 1 }}>{locale === 'ar' ? o.title_ar : o.title_en}</Txt>
              <Muted>{o.category === 'toys' ? t.offerToys : t.offerClothing}</Muted>
            </Row>
            <Muted>{locale === 'ar' ? o.store_ar : o.store_en}</Muted>
            {(locale === 'ar' ? o.details_ar : o.details_en) ? <Txt>{locale === 'ar' ? o.details_ar : o.details_en}</Txt> : null}
            <Muted style={{ fontSize: 12 }}>
              {t.offerEnds}: {formatDay(o.ends_on, locale)}
            </Muted>
          </Card>
        ))
      )}
      <View style={{ height: space.lg }} />
    </>
  );
}
