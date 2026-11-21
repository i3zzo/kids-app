// One vaccination dose: mark it given (date + optional health centre),
// undo, or move it to another date.
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { DateField } from '@/components/DateField';
import { Button, Card, ErrorText, Field, Muted, Screen, Skeleton, Title, Txt } from '@/components/ui';
import { getVaccination, updateVaccination, type ChildVaccination } from '@/lib/api';
import { parseDay, toDay } from '@/lib/dates';
import { formatDay, useI18n } from '@/lib/i18n';
import { useLoad } from '@/lib/useLoad';
import { colors } from '@/theme';

export default function Dose() {
  const { t } = useI18n();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error } = useLoad(() => getVaccination(id), [id]);
  if (error) return <Screen><ErrorText>{t.somethingWrong}</ErrorText></Screen>;
  if (!data) return <Screen><Skeleton /></Screen>;
  return <DoseForm dose={data} />;
}

function DoseForm({ dose }: { dose: ChildVaccination }) {
  const { t, locale } = useI18n();
  const today = new Date();
  const [given, setGiven] = useState(dose.done_on ? parseDay(dose.done_on) : parseDay(dose.due_date) > today ? today : parseDay(dose.due_date));
  const [due, setDue] = useState(parseDay(dose.due_date));
  const [clinic, setClinic] = useState(dose.clinic ?? '');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Not optimistic on purpose: this is a health record, so we show a
  // "saving" state and only go back once the server has confirmed.
  async function save(kind: string, patch: Parameters<typeof updateVaccination>[1]) {
    setBusy(kind);
    setError(null);
    try {
      await updateVaccination(dose.id, patch);
      router.back();
    } catch {
      setError(t.somethingWrong);
      setBusy(null);
    }
  }

  const v = dose.vaccine_doses;
  return (
    <Screen>
      <Title>{locale === 'ar' ? v.name_ar : v.name_en}</Title>
      <Muted>{locale === 'ar' ? v.dose_label_ar : v.dose_label_en}</Muted>
      <Card style={{ backgroundColor: colors.sand, borderColor: colors.sand }}>
        <Txt style={{ fontSize: 14 }}>{t.scheduleDisclaimer}</Txt>
      </Card>

      {dose.status === 'done' ? (
        <>
          <Txt style={{ color: colors.success, fontWeight: '700' }}>
            ✓ {t.doneOn} {formatDay(dose.done_on!, locale)}
            {dose.clinic ? ` · ${dose.clinic}` : ''}
          </Txt>
          <Button title={t.markNotDone} variant="secondary" loading={busy === 'undo'} disabled={!!busy} onPress={() => save('undo', { status: 'due', done_on: null })} />
        </>
      ) : (
        <>
          <Muted>{t.dueOn}: {formatDay(dose.due_date, locale)}</Muted>
          <DateField label={t.doseDate} value={given} onChange={setGiven} maximumDate={today} />
          <Field label={t.clinic} value={clinic} onChangeText={setClinic} maxLength={80} />
          <Button
            title={t.markDone}
            loading={busy === 'done'}
            disabled={!!busy}
            testID="mark-done"
            onPress={() => save('done', { status: 'done', done_on: toDay(given), clinic: clinic.trim() || null })}
          />
          <DateField label={t.reschedule} value={due} onChange={setDue} />
          <Button
            title={t.save}
            variant="secondary"
            loading={busy === 'move'}
            disabled={!!busy || toDay(due) === dose.due_date}
            onPress={() => save('move', { due_date: toDay(due) })}
          />
        </>
      )}
      {error ? <ErrorText>{error}</ErrorText> : null}
    </Screen>
  );
}
