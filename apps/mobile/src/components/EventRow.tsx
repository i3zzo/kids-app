import { router } from 'expo-router';
import type { CalendarEvent, Child } from '@/lib/api';
import { formatDay, formatTime, useI18n } from '@/lib/i18n';
import { colors } from '@/theme';
import { Card, Dot, Muted, Row, Txt } from './ui';

export function EventRow({ e, child, showDate }: { e: CalendarEvent; child?: Child; showDate?: boolean }) {
  const { t, locale } = useI18n();
  const d = new Date(e.starts_at);
  return (
    <Card onPress={() => router.push(`/event/${e.id}`)}>
      <Row>
        <Dot color={child?.color ?? colors.muted} />
        <Txt style={{ fontWeight: '700', flex: 1 }}>{e.title}</Txt>
        <Muted>{e.all_day ? t.allDay : formatTime(d, locale)}</Muted>
      </Row>
      <Muted>
        {[showDate ? formatDay(d, locale, { weekday: 'long', day: 'numeric', month: 'short' }) : null, child?.first_name ?? t.wholeFamily, e.location]
          .filter(Boolean)
          .join(' · ')}
      </Muted>
    </Card>
  );
}
