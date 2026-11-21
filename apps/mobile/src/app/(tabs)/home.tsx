// Home: today at a glance — today's events, the next vaccination for each
// child (overdue ones first), and the coming week.
import { router } from 'expo-router';
import { View } from 'react-native';
import { EventRow } from '@/components/EventRow';
import { RemindersCard } from '@/components/RemindersCard';
import { Button, Card, Dot, ErrorText, Muted, Row, Screen, Skeleton, Title, Txt } from '@/components/ui';
import { listChildren, listEvents, listLowSupplies, listOpenVaccinations, listTipsForAges, type AgedTip, type Child, type ChildVaccination } from '@/lib/api';
import { addDays, ageParts, toDay } from '@/lib/dates';
import { tipOfTheDay } from '@/lib/tips';
import { expandEvents } from '@/lib/recurrence';
import { formatDay, useI18n } from '@/lib/i18n';
import { useFamily } from '@/lib/session';
import { useLoad } from '@/lib/useLoad';
import { colors, space } from '@/theme';

export default function Home() {
  const { t, locale } = useI18n();
  const { familyId, familyName } = useFamily();

  const { data, error, reload } = useLoad(async () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    // Children first (tips depend on their ages), then four independent
    // requests sent at the same time.
    const childrenP = listChildren();
    const [children, events, doses, low, tips] = await Promise.all([
      childrenP,
      listEvents(familyId, start, addDays(start, 8)),
      listOpenVaccinations(familyId, toDay(addDays(start, 90))),
      listLowSupplies(familyId),
      childrenP.then((cs) => {
        if (!cs.length) return [] as AgedTip[];
        const ages = cs.map(monthsOld);
        return listTipsForAges(Math.min(...ages), Math.max(...ages));
      }),
    ]);
    return { children, events: expandEvents(events, start, addDays(start, 8)), doses, low, tips, today: toDay(start) };
  }, [familyId]);

  if (error) return <Screen><ErrorText>{t.somethingWrong}</ErrorText><Button title={t.retry} onPress={reload} /></Screen>;
  if (!data) return <Screen><Skeleton lines={5} /></Screen>;

  const byId = new Map(data.children.map((c) => [c.id, c]));
  const todays = data.events.filter((e) => toDay(new Date(e.starts_at)) === data.today);
  const week = data.events.filter((e) => toDay(new Date(e.starts_at)) !== data.today);

  // Next open dose per child (list is already sorted by due date).
  const nextPerChild = new Map<string, ChildVaccination>();
  for (const d of data.doses) if (!nextPerChild.has(d.child_id)) nextPerChild.set(d.child_id, d);

  return (
    <Screen>
      <View style={{ gap: 2 }}>
        <Muted>{formatDay(new Date(), locale, { weekday: 'long', day: 'numeric', month: 'long' })}</Muted>
        <Title>{t.hello}{locale === 'ar' ? '،' : ','} {familyName}</Title>
      </View>

      <RemindersCard hideWhenOn />

      <Section title={t.today}>
        {todays.length === 0 ? <Muted>{t.nothingToday}</Muted> : todays.map((e) => <EventRow key={e.key} e={e} child={e.child_id ? byId.get(e.child_id) : undefined} />)}
      </Section>

      <Section title={t.nextVaccine}>
        {data.children.map((c) => {
          const d = nextPerChild.get(c.id);
          return (
            <Card key={c.id} onPress={() => (d ? router.push(`/dose/${d.id}`) : router.push(`/vaccines/${c.id}`))}>
              <Row>
                <Dot color={c.color} />
                <Txt style={{ fontWeight: '700', flex: 1 }}>{c.first_name}</Txt>
                {d && d.due_date < data.today ? <Txt style={{ color: colors.danger, fontWeight: '700' }}>{t.overdue}</Txt> : null}
              </Row>
              {d ? (
                <>
                  <Txt>{locale === 'ar' ? d.vaccine_doses.name_ar : d.vaccine_doses.name_en} — {locale === 'ar' ? d.vaccine_doses.dose_label_ar : d.vaccine_doses.dose_label_en}</Txt>
                  <Muted>{t.dueOn}: {formatDay(d.due_date, locale)}</Muted>
                </>
              ) : (
                <Muted>{t.noUpcomingVaccines}</Muted>
              )}
            </Card>
          );
        })}
      </Section>

      {data.tips.length > 0 ? (
        <Section title={t.tipOfTheDay}>
          {data.children.map((c) => {
            const age = monthsOld(c);
            const tip = tipOfTheDay(
              data.tips.filter((x) => x.min_age_months <= age && x.max_age_months >= age && (!x.only_gender || x.only_gender === c.gender)),
              data.today,
              c.id,
            );
            if (!tip) return null;
            return (
              <Card key={c.id} onPress={() => router.push(`/tips/${c.id}`)} testID={`tip-${c.id}`}>
                <Row>
                  <Dot color={c.color} />
                  <Txt style={{ fontWeight: '700', flex: 1 }}>{c.first_name}</Txt>
                  <Muted>{t[`sec_${tip.section}`]}</Muted>
                </Row>
                <Txt style={{ fontWeight: '700' }}>{locale === 'ar' ? tip.title_ar : tip.title_en}</Txt>
                <Txt numberOfLines={3}>{locale === 'ar' ? tip.body_ar : tip.body_en}</Txt>
                <Txt style={{ color: colors.tealDark, fontWeight: '700' }}>{t.allTips} {locale === 'ar' ? '‹' : '›'}</Txt>
              </Card>
            );
          })}
        </Section>
      ) : null}

      {data.low.length > 0 ? (
        <Section title={t.lowSupplies}>
          {data.low.map((i) => {
            const c = byId.get(i.child_id);
            return (
              <Card key={i.id} onPress={() => router.push('/supplies')}>
                <Row>
                  <Dot color={c?.color ?? colors.muted} />
                  <Txt style={{ fontWeight: '700', flex: 1 }}>{i.name}</Txt>
                  <Txt style={{ color: i.quantity === 0 ? colors.danger : colors.warning, fontWeight: '700' }}>
                    {i.quantity === 0 ? t.finished : `${i.quantity} ${t[`unit_${i.unit}`]}`}
                  </Txt>
                </Row>
                {c ? <Muted>{c.first_name}</Muted> : null}
              </Card>
            );
          })}
        </Section>
      ) : null}

      {week.length > 0 ? (
        <Section title={t.upcomingWeek}>
          {week.map((e) => <EventRow key={e.key} e={e} child={e.child_id ? byId.get(e.child_id) : undefined} showDate />)}
        </Section>
      ) : null}
    </Screen>
  );
}

function monthsOld(c: Pick<Child, 'birth_date'>) {
  const { years, months } = ageParts(c.birth_date);
  return years * 12 + months;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: space.sm }}>
      <Txt style={{ fontSize: 18, fontWeight: '700' }} accessibilityRole="header">{title}</Txt>
      {children}
    </View>
  );
}
