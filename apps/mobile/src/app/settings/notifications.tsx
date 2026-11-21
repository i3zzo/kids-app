// Each parent's own reminder choices. Saved in the database
// (notification_settings), which the reminder job reads every 5 minutes.
import { useEffect, useState } from 'react';
import { Switch } from 'react-native';
import { DateField } from '@/components/DateField';
import { RemindersCard } from '@/components/RemindersCard';
import { Button, Choice, ErrorText, Muted, Row, Screen, Skeleton, Txt } from '@/components/ui';
import { getNotificationSettings, saveNotificationSettings, type NotificationSettings } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { useLoad } from '@/lib/useLoad';
import { colors } from '@/theme';

const toDate = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
};
const toHHMM = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:00`;

export default function NotificationSettingsScreen() {
  const { t } = useI18n();
  const { session } = useSession();
  const { data, error, reload } = useLoad(getNotificationSettings, []);
  const [s, setS] = useState<NotificationSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<'saved' | 'error' | null>(null);

  useEffect(() => {
    if (data) setS(data);
  }, [data]);

  if (error) return <Screen><ErrorText>{t.somethingWrong}</ErrorText><Button title={t.retry} onPress={reload} /></Screen>;
  if (!s) return <Screen><Skeleton lines={4} /></Screen>;

  const set = (patch: Partial<NotificationSettings>) => {
    setMsg(null);
    setS({ ...s, ...patch });
  };

  return (
    <Screen>
      <RemindersCard />
      <Row style={{ justifyContent: 'space-between' }}>
        <Txt style={{ fontWeight: '600', flex: 1 }}>{t.notifyVaccines}</Txt>
        <Switch value={s.vaccines} onValueChange={(v) => set({ vaccines: v })} trackColor={{ true: colors.teal }} accessibilityLabel={t.notifyVaccines} />
      </Row>
      {s.vaccines ? (
        <>
          <Choice
            label={t.vaccineDaysBefore}
            value={String(s.vaccine_days_before) as '1' | '3' | '7'}
            onChange={(v) => set({ vaccine_days_before: Number(v) })}
            options={(['1', '3', '7'] as const).map((n) => ({ value: n, label: t[`days_${n}`] }))}
          />
          <Muted>{t.vaccineReminderNote}</Muted>
        </>
      ) : null}
      <Row style={{ justifyContent: 'space-between' }}>
        <Txt style={{ fontWeight: '600', flex: 1 }}>{t.notifyEvents}</Txt>
        <Switch value={s.events} onValueChange={(v) => set({ events: v })} trackColor={{ true: colors.teal }} accessibilityLabel={t.notifyEvents} />
      </Row>
      <Row style={{ justifyContent: 'space-between' }}>
        <Txt style={{ fontWeight: '600', flex: 1 }}>{t.notifySupplies}</Txt>
        <Switch value={s.supplies} onValueChange={(v) => set({ supplies: v })} trackColor={{ true: colors.teal }} accessibilityLabel={t.notifySupplies} />
      </Row>
      <Txt style={{ fontWeight: '600' }}>{t.quietHours}</Txt>
      <DateField label={t.quietFrom} mode="time" value={toDate(s.quiet_start)} onChange={(d) => set({ quiet_start: toHHMM(d) })} />
      <DateField label={t.quietTo} mode="time" value={toDate(s.quiet_end)} onChange={(d) => set({ quiet_end: toHHMM(d) })} />
      {msg === 'error' ? <ErrorText>{t.somethingWrong}</ErrorText> : msg === 'saved' ? <Muted>✓ {t.saved}</Muted> : null}
      <Button
        title={t.save}
        loading={busy}
        testID="save-notifications"
        onPress={async () => {
          if (!session) return;
          setBusy(true);
          try {
            await saveNotificationSettings(session.user.id, s);
            setMsg('saved');
          } catch {
            setMsg('error');
          } finally {
            setBusy(false);
          }
        }}
      />
    </Screen>
  );
}
