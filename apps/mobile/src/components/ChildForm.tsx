// The form for adding or editing a child. Basic data only — by design there is
// no field for civil ID or passport numbers. The special needs part is
// optional and private to the family (see lib/api saveChildSupport).
import { useState } from 'react';
import { View } from 'react-native';
import { EMPTY_SUPPORT, NEEDS, type Child, type ChildSupport, type Gender, type NationalityGroup, type Need } from '@/lib/api';
import { addDays, maxBirthAgeDay, parseDay, toDay } from '@/lib/dates';
import { useI18n } from '@/lib/i18n';
import { childColors, space } from '@/theme';
import { DateField } from './DateField';
import { Button, Choice, ErrorText, Field, Muted, MultiChoice, Txt } from './ui';

export type ChildInput = Omit<Child, 'id'>;

export function ChildForm({
  initial,
  initialSupport,
  submitLabel,
  onSubmit,
}: {
  initial?: ChildInput;
  initialSupport?: ChildSupport;
  submitLabel: string;
  onSubmit: (c: ChildInput, support: ChildSupport) => Promise<void>;
}) {
  const { t } = useI18n();
  const [firstName, setFirstName] = useState(initial?.first_name ?? '');
  const [birth, setBirth] = useState<Date>(initial ? parseDay(initial.birth_date) : new Date());
  const [gender, setGender] = useState<Gender | null>(initial?.gender ?? null);
  const [nat, setNat] = useState<NationalityGroup | null>(initial?.nationality_group ?? null);
  const [color, setColor] = useState(initial?.color ?? childColors[0]);
  const support0 = initialSupport ?? EMPTY_SUPPORT;
  const [needs, setNeeds] = useState<Need[]>(support0.needs);
  const [notes, setNotes] = useState(support0.notes ?? '');
  const [pada, setPada] = useState<boolean | null>(support0.has_pada_card);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const today = new Date();
  const minBirth = parseDay(maxBirthAgeDay(today));

  async function submit() {
    setError(null);
    const name = firstName.trim();
    if (!name) return setError(t.invalidName);
    if (birth > today || birth < minBirth) return setError(t.invalidBirth);
    if (!gender) return setError(t.gender);
    setBusy(true);
    try {
      // Notes are one short line; control characters are refused by the database.
      const cleanNotes = notes.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 300) || null;
      await onSubmit(
        { first_name: name, birth_date: toDay(birth), gender, nationality_group: nat, color },
        // with no needs picked, the note and card answer (hidden) are cleared too
        needs.length ? { needs: NEEDS.filter((n) => needs.includes(n)), notes: cleanNotes, has_pada_card: pada } : EMPTY_SUPPORT,
      );
    } catch {
      setError(t.somethingWrong);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Field label={t.firstName} value={firstName} onChangeText={setFirstName} maxLength={40} autoComplete="off" testID="child-name" />
      <DateField label={t.birthDate} value={birth} onChange={setBirth} maximumDate={today} minimumDate={addDays(minBirth, 0)} />
      <Choice
        label={t.gender}
        value={gender}
        onChange={setGender}
        options={[
          { value: 'girl', label: t.girl },
          { value: 'boy', label: t.boy },
        ]}
      />
      <Choice
        label={t.nationalityGroup}
        value={nat}
        onChange={(v) => setNat(v === nat ? null : v)}
        options={[
          { value: 'kuwaiti', label: t.kuwaiti },
          { value: 'gcc', label: t.gcc },
          { value: 'other', label: t.other },
        ]}
      />
      <Choice label={t.color} value={color} onChange={setColor} options={childColors.map((c, i) => ({ value: c, label: `${t.color} ${i + 1}`, color: c }))} />
      <Muted>{t.childBasicsNote}</Muted>
      <View style={{ gap: space.sm, marginTop: space.sm }} testID="child-support">
        <Txt style={{ fontSize: 17, fontWeight: '700' }}>{t.supportTitle}</Txt>
        <Muted>{t.supportIntro}</Muted>
        <MultiChoice values={needs} onChange={setNeeds} options={NEEDS.map((n) => ({ value: n, label: t[`need_${n}`] }))} />
        {needs.length ? (
          <>
            <Field label={t.supportNotes} value={notes} onChangeText={setNotes} maxLength={300} autoComplete="off" testID="child-support-notes" />
            <Choice
              label={t.hasPadaCard}
              value={pada === null ? null : pada ? 'yes' : 'no'}
              onChange={(v) => setPada(pada === (v === 'yes') ? null : v === 'yes')}
              options={[
                { value: 'yes', label: t.yes },
                { value: 'no', label: t.no },
              ]}
            />
          </>
        ) : null}
      </View>
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Button title={submitLabel} onPress={submit} loading={busy} testID="child-submit" />
    </>
  );
}
