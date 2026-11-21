// Calendar: a month grid with coloured dots per child, and the chosen day's
// events and vaccinations underneath. Filter by child at the top.
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { EventRow } from '@/components/EventRow';
import { Button, Card, Choice, Dot, ErrorText, Muted, Row, Screen, Skeleton, Txt } from '@/components/ui';
import { listChildren, listEvents, listVaccinationsBetween, type CalendarEvent, type ChildVaccination } from '@/lib/api';
import { addDays, monthGrid, toDay } from '@/lib/dates';
import { expandEvents } from '@/lib/recurrence';
import { formatDay, useI18n } from '@/lib/i18n';
import { useFamily } from '@/lib/session';
import { useLoad } from '@/lib/useLoad';
import { colors, radius, space } from '@/theme';

export default function Calendar() {
  const { t, locale, isRTL } = useI18n();
  const { familyId } = useFamily();
  const now = new Date();
  const [month, setMonth] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [selected, setSelected] = useState(toDay(now));
  const [childFilter, setChildFilter] = useState<string>('all');

  const grid = useMemo(() => monthGrid(month.y, month.m), [month]);
  const from = grid[0];
  const to = addDays(grid[grid.length - 1], 1);

  // Only the visible 6 weeks are fetched; the three requests run in parallel.
  const { data, error, reload } = useLoad(
    () =>
      Promise.all([
        listChildren(),
        listEvents(familyId, from, to),
        listVaccinationsBetween(familyId, toDay(from), toDay(addDays(to, -1))),
      ]).then(([children, events, doses]) => ({ children, events, doses })),
    [familyId, month.y, month.m],
  );

  const byDay = useMemo(() => {
    const map = new Map<string, { colors: Set<string>; events: (CalendarEvent & { key: string })[]; doses: ChildVaccination[] }>();
    if (!data) return map;
    const childColor = new Map(data.children.map((c) => [c.id, c.color]));
    const get = (k: string) => {
      let v = map.get(k);
      if (!v) map.set(k, (v = { colors: new Set(), events: [], doses: [] }));
      return v;
    };
    // Repeating events are stored once; show each of their dates in view.
    for (const e of expandEvents(data.events, from, to)) {
      if (childFilter !== 'all' && e.child_id !== childFilter) continue;
      const v = get(toDay(new Date(e.starts_at)));
      v.events.push(e);
      v.colors.add(e.child_id ? childColor.get(e.child_id) ?? colors.muted : colors.muted);
    }
    for (const d of data.doses) {
      if (childFilter !== 'all' && d.child_id !== childFilter) continue;
      const v = get(d.due_date);
      v.doses.push(d);
      v.colors.add(childColor.get(d.child_id) ?? colors.muted);
    }
    return map;
  }, [data, childFilter]);

  const shiftMonth = (delta: number) => {
    const d = new Date(month.y, month.m + delta, 1);
    setMonth({ y: d.getFullYear(), m: d.getMonth() });
  };

  const day = byDay.get(selected);
  const childById = new Map((data?.children ?? []).map((c) => [c.id, c]));
  const todayStr = toDay(now);

  return (
    <View style={{ flex: 1 }}>
      <Screen>
        {data ? (
          <Choice
            value={childFilter}
            onChange={setChildFilter}
            options={[{ value: 'all', label: t.allChildren }, ...data.children.map((c) => ({ value: c.id, label: c.first_name }))]}
          />
        ) : null}

        <Row style={{ justifyContent: 'space-between' }}>
          <Pressable accessibilityRole="button" accessibilityLabel="previous month" onPress={() => shiftMonth(-1)} style={s.navBtn}>
            <Text style={s.navTxt}>{isRTL ? '›' : '‹'}</Text>
          </Pressable>
          <Txt style={{ fontSize: 18, fontWeight: '700' }}>{formatDay(new Date(month.y, month.m, 1), locale, { month: 'long', year: 'numeric' })}</Txt>
          <Pressable accessibilityRole="button" accessibilityLabel="next month" onPress={() => shiftMonth(1)} style={s.navBtn}>
            <Text style={s.navTxt}>{isRTL ? '‹' : '›'}</Text>
          </Pressable>
        </Row>

        <View>
          <View style={[s.week, isRTL && s.rtl]}>
            {t.weekdays.map((w) => (
              <Text key={w} style={s.weekday}>{w}</Text>
            ))}
          </View>
          {[0, 1, 2, 3, 4, 5].map((w) => (
            <View key={w} style={[s.week, isRTL && s.rtl]}>
              {grid.slice(w * 7, w * 7 + 7).map((d) => {
                const k = toDay(d);
                const inMonth = d.getMonth() === month.m;
                const isSel = k === selected;
                const dots = [...(byDay.get(k)?.colors ?? [])].slice(0, 3);
                return (
                  <Pressable
                    key={k}
                    accessibilityRole="button"
                    accessibilityLabel={formatDay(d, locale)}
                    accessibilityState={{ selected: isSel }}
                    onPress={() => setSelected(k)}
                    style={[s.cell, isSel && s.cellSel, k === todayStr && !isSel && s.cellToday]}
                  >
                    <Text style={[s.dayNum, !inMonth && { color: '#B4BCC6' }, isSel && { color: colors.white }]}>
                      {new Intl.NumberFormat(locale === 'ar' ? 'ar-KW' : 'en-GB').format(d.getDate())}
                    </Text>
                    <View style={s.dots}>
                      {dots.map((c) => (
                        <Dot key={c} color={isSel ? colors.white : c} size={6} />
                      ))}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>

        <Txt style={{ fontSize: 18, fontWeight: '700' }}>{formatDay(selected, locale, { weekday: 'long', day: 'numeric', month: 'long' })}</Txt>
        {error ? (
          <>
            <ErrorText>{t.somethingWrong}</ErrorText>
            <Button title={t.retry} onPress={reload} variant="secondary" />
          </>
        ) : !data ? (
          <Skeleton lines={2} />
        ) : !day || (day.events.length === 0 && day.doses.length === 0) ? (
          <Muted>{t.noEventsDay}</Muted>
        ) : (
          <>
            {day.doses.map((d) => {
              const c = childById.get(d.child_id);
              return (
                <Card key={d.id} onPress={() => router.push(`/dose/${d.id}`)} style={{ borderColor: c?.color ?? colors.line }}>
                  <Row>
                    <Dot color={c?.color ?? colors.muted} />
                    <Txt style={{ fontWeight: '700', flex: 1 }}>💉 {locale === 'ar' ? d.vaccine_doses.name_ar : d.vaccine_doses.name_en}</Txt>
                    <Muted>{d.status === 'done' ? t.statusDone : d.status === 'skipped' ? t.statusSkipped : d.due_date < todayStr ? t.overdue : t.statusDue}</Muted>
                  </Row>
                  <Muted>{[c?.first_name, locale === 'ar' ? d.vaccine_doses.dose_label_ar : d.vaccine_doses.dose_label_en].join(' · ')}</Muted>
                </Card>
              );
            })}
            {day.events.map((e) => (
              <EventRow key={e.key} e={e} child={e.child_id ? childById.get(e.child_id) : undefined} />
            ))}
          </>
        )}
        <View style={{ height: 72 }} />
      </Screen>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t.addEvent}
        testID="add-event"
        onPress={() => router.push({ pathname: '/event/new', params: { day: selected, child: childFilter === 'all' ? '' : childFilter } })}
        style={[s.fab, isRTL ? { left: space.xl } : { right: space.xl }]}
      >
        <Text style={{ color: colors.white, fontSize: 30, lineHeight: 32 }}>+</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  week: { flexDirection: 'row' },
  rtl: { flexDirection: 'row-reverse' },
  weekday: { flex: 1, textAlign: 'center', color: colors.muted, fontSize: 12, paddingVertical: 4 },
  cell: { flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, maxHeight: 56 },
  cellSel: { backgroundColor: colors.teal },
  cellToday: { borderWidth: 2, borderColor: colors.coral },
  dayNum: { fontSize: 15, color: colors.ink, fontWeight: '600' },
  dots: { flexDirection: 'row', gap: 2, height: 8, marginTop: 2 },
  navBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: colors.white },
  navTxt: { fontSize: 26, color: colors.tealDark, lineHeight: 28 },
  fab: {
    position: 'absolute',
    bottom: space.xl,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
});
