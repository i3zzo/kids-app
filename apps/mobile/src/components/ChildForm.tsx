// The form for adding or editing a child. Basic data only — by design there is
// no field for civil ID or passport numbers.
import { useState } from 'react';
import type { Child, Gender, NationalityGroup } from '@/lib/api';
import { addDays, maxBirthAgeDay, parseDay, toDay } from '@/lib/dates';
import { useI18n } from '@/lib/i18n';
import { childColors } from '@/theme';
import { DateField } from './DateField';
import { Button, Choice, ErrorText, Field, Muted } from './ui';

export type ChildInput = Omit<Child, 'id'>;

export function ChildForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial?: ChildInput;
  submitLabel: string;
  onSubmit: (c: ChildInput) => Promise<void>;
}) {
  const { t } = useI18n();
  const [firstName, setFirstName] = useState(initial?.first_name ?? '');
  const [birth, setBirth] = useState<Date>(initial ? parseDay(initial.birth_date) : new Date());
  const [gender, setGender] = useState<Gender | null>(initial?.gender ?? null);
  const [nat, setNat] = useState<NationalityGroup | null>(initial?.nationality_group ?? null);
  const [color, setColor] = useState(initial?.color ?? childColors[0]);
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
      await onSubmit({ first_name: name, birth_date: toDay(birth), gender, nationality_group: nat, color });
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
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Button title={submitLabel} onPress={submit} loading={busy} testID="child-submit" />
    </>
  );
}
