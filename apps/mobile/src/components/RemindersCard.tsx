// "Turn on reminders": the phone's permission prompt only appears after the
// parent taps this, never by surprise at launch.
import { useEffect, useState } from 'react';
import { Linking } from 'react-native';
import { enablePush, pushStatus, type PushStatus } from '@/lib/notifications';
import { useI18n } from '@/lib/i18n';
import { colors } from '@/theme';
import { Button, Card, Muted, Txt } from './ui';

export function RemindersCard({ hideWhenOn = false }: { hideWhenOn?: boolean }) {
  const { t, locale } = useI18n();
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    pushStatus().then(setStatus, () => setStatus('unsupported'));
  }, []);

  if (status === null) return null;
  if (hideWhenOn && (status === 'granted' || status === 'unsupported')) return null;

  if (status === 'granted') return <Muted>✓ {t.remindersOn}</Muted>;
  if (status === 'unsupported') return <Muted>{t.remindersUnsupported}</Muted>;

  return (
    <Card style={{ backgroundColor: colors.tealLight, borderColor: colors.tealLight }} testID="reminders-card">
      <Txt style={{ fontWeight: '700' }}>🔔 {t.turnOnReminders}</Txt>
      <Muted>{status === 'denied' ? t.remindersBlocked : t.turnOnRemindersHint}</Muted>
      {failed ? <Txt style={{ color: colors.danger }}>{t.somethingWrong}</Txt> : null}
      {status === 'denied' ? (
        <Button title={t.openPhoneSettings} variant="secondary" onPress={() => Linking.openSettings()} />
      ) : (
        <Button
          title={t.turnOnReminders}
          loading={busy}
          onPress={async () => {
            setBusy(true);
            setFailed(false);
            try {
              setStatus(await enablePush(locale));
            } catch {
              setFailed(true);
            } finally {
              setBusy(false);
            }
          }}
        />
      )}
    </Card>
  );
}
