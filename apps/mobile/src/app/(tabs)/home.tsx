// Home: today at a glance — today's events, the next vaccination for each
// child (overdue ones first), and the coming week.
import { router } from 'expo-router';
import { View } from 'react-native';
import { EventRow } from '@/components/EventRow';
import { RemindersCard } from '@/components/RemindersCard';
import { Button, Card, Dot, ErrorText, Muted, Row, Screen, Skeleton, Title, Txt } from '@/components/ui';
import { listChildren, listEvents, listOpenVaccinations, type ChildVaccination } from '@/lib/api';
import { addDays, toDay } from '@/lib/dates';
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
    // Three independent requests, sent at the same time.
    const [children, events, doses] = await Promise.all([
      listChildren(),
      listEvents(familyId, start, addDays(start, 8)),
      listOpenVaccinations(familyId, toDay(addDays(start, 90))),
    ]);
    return { children, events: expandEvents(events, start, addDays(start, 8)), doses, today: toDay(start) };
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

      {week.length > 0 ? (
        <Section title={t.upcomingWeek}>
          {week.map((e) => <EventRow key={e.key} e={e} child={e.child_id ? byId.get(e.child_id) : undefined} showDate />)}
        </Section>
      ) : null}
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: space.sm }}>
      <Txt style={{ fontSize: 18, fontWeight: '700' }} accessibilityRole="header">{title}</Txt>
      {children}
    </View>
  );
}
