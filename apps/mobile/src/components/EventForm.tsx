// Add / edit a calendar event (training, class, appointment, anything).
import { useState } from 'react';
import { Switch } from 'react-native';
import type { CalendarEvent, Child, EventKind } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { colors } from '@/theme';
import { DateField } from './DateField';
import { Button, Choice, ErrorText, Field, Row, Txt } from './ui';

export type EventInput = Omit<CalendarEvent, 'id'>;
const KINDS: EventKind[] = ['activity', 'training', 'class', 'appointment', 'other'];

export function EventForm({
  initial,
  children,
  onSubmit,
}: {
  initial: EventInput;
  children: Child[];
  onSubmit: (e: EventInput) => Promise<void>;
}) {
  const { t } = useI18n();
  const [title, setTitle] = useState(initial.title);
  const [kind, setKind] = useState<EventKind>(initial.kind);
  const [childId, setChildId] = useState<string>(initial.child_id ?? 'family');
  const [start, setStart] = useState(new Date(initial.starts_at));
  const [allDay, setAllDay] = useState(initial.all_day);
  const [location, setLocation] = useState(initial.location ?? '');
  const [notes, setNotes] = useState(initial.notes ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!title.trim()) return setError(t.invalidTitle);
    setError(null);
    setBusy(true);
    const s = new Date(start);
    if (allDay) s.setHours(0, 0, 0, 0);
    try {
      await onSubmit({
        title: title.trim(),
        kind,
        child_id: childId === 'family' ? null : childId,
        starts_at: s.toISOString(),
        ends_at: null,
        all_day: allDay,
        location: location.trim() || null,
        notes: notes.trim() || null,
      });
    } catch {
      setError(t.somethingWrong);
      setBusy(false);
    }
  }

  return (
    <>
      <Field label={t.eventTitle} placeholder={t.eventTitlePlaceholder} value={title} onChangeText={setTitle} maxLength={80} testID="event-title" />
      <Choice label={t.eventKind} value={kind} onChange={setKind} options={KINDS.map((k) => ({ value: k, label: t[`kind_${k}`] }))} />
      <Choice
        label={t.forChild}
        value={childId}
        onChange={setChildId}
        options={[{ value: 'family', label: t.wholeFamily }, ...children.map((c) => ({ value: c.id, label: c.first_name }))]}
      />
      <DateField label={t.date} value={start} onChange={setStart} />
      <Row style={{ justifyContent: 'space-between' }}>
        <Txt style={{ fontWeight: '600' }}>{t.allDay}</Txt>
        <Switch value={allDay} onValueChange={setAllDay} trackColor={{ true: colors.teal }} accessibilityLabel={t.allDay} />
      </Row>
      {allDay ? null : <DateField label={t.time} value={start} onChange={setStart} mode="time" />}
      <Field label={t.location} value={location} onChangeText={setLocation} maxLength={120} />
      <Field label={t.notes} value={notes} onChangeText={setNotes} maxLength={1000} multiline />
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Button title={t.save} onPress={submit} loading={busy} testID="event-save" />
    </>
  );
}
