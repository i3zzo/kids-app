// Add / edit a calendar event (training, class, appointment, anything).
import { useState } from 'react';
import { Switch } from 'react-native';
import type { CalendarEvent, Child, EventKind, Repeat } from '@/lib/api';
import { parseDay, toDay } from '@/lib/dates';
import { useI18n } from '@/lib/i18n';
import { colors } from '@/theme';
import { DateField } from './DateField';
import { Button, Choice, ErrorText, Field, Row, Txt } from './ui';

export type EventInput = Omit<CalendarEvent, 'id'>;
const KINDS: EventKind[] = ['activity', 'training', 'class', 'appointment', 'other'];
const REPEATS: Repeat[] = ['none', 'daily', 'weekly', 'monthly'];
const REMINDERS = ['none', '0', '15', '60', '1440'] as const;
type ReminderChoice = (typeof REMINDERS)[number];

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
  const [repeat, setRepeat] = useState<Repeat>(initial.repeat);
  const [hasEnd, setHasEnd] = useState(initial.repeat_until ? 'date' : 'forever');
  const [until, setUntil] = useState(initial.repeat_until ? parseDay(initial.repeat_until) : addMonths(new Date(initial.starts_at), 3));
  const [remind, setRemind] = useState<ReminderChoice>(
    initial.remind_minutes_before == null ? 'none' : ((REMINDERS as readonly string[]).includes(String(initial.remind_minutes_before)) ? (String(initial.remind_minutes_before) as ReminderChoice) : '60'),
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!title.trim()) return setError(t.invalidTitle);
    if (repeat !== 'none' && hasEnd === 'date' && toDay(until) < toDay(start)) return setError(t.invalidUntil);
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
        repeat,
        repeat_until: repeat !== 'none' && hasEnd === 'date' ? toDay(until) : null,
        remind_minutes_before: remind === 'none' ? null : Number(remind),
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
      <Choice label={t.repeat} value={repeat} onChange={setRepeat} options={REPEATS.map((r) => ({ value: r, label: t[`repeat_${r}`] }))} />
      {repeat === 'none' ? null : (
        <>
          <Choice
            label={t.repeatUntil}
            value={hasEnd}
            onChange={setHasEnd}
            options={[
              { value: 'forever', label: t.repeatForever },
              { value: 'date', label: t.repeatEndOn },
            ]}
          />
          {hasEnd === 'date' ? <DateField label={t.repeatUntil} value={until} onChange={setUntil} /> : null}
        </>
      )}
      <Choice label={t.reminder} value={remind} onChange={setRemind} options={REMINDERS.map((r) => ({ value: r, label: t[`remind_${r}`] }))} />
      <Field label={t.location} value={location} onChangeText={setLocation} maxLength={120} />
      <Field label={t.notes} value={notes} onChangeText={setNotes} maxLength={1000} multiline />
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Button title={t.save} onPress={submit} loading={busy} testID="event-save" />
    </>
  );
}

function addMonths(d: Date, n: number) {
  const r = new Date(d);
  r.setMonth(r.getMonth() + n);
  return r;
}
