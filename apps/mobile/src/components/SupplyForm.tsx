// Add / edit one supply item for a child.
import { useState } from 'react';
import { listBrands, SUPPLY_CATEGORIES, SUPPLY_UNITS, type BrandKind, type SupplyCategory, type SupplyInput, type SupplyUnit } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useLoad } from '@/lib/useLoad';
import { Button, Choice, ErrorText, Field } from './ui';

const BRAND_KINDS: Partial<Record<SupplyCategory, BrandKind[]>> = {
  feeding: ['formula'],
  diapering: ['diapers', 'wipes'],
  health: ['baby_care'],
};

const toInt = (s: string) => {
  const n = parseInt(s.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))), 10);
  return Number.isFinite(n) ? n : NaN;
};

export function SupplyForm({ initial, onSubmit }: { initial: SupplyInput; onSubmit: (s: SupplyInput) => Promise<void> }) {
  const { t, locale } = useI18n();
  const [category, setCategory] = useState<SupplyCategory>(initial.category);
  const [name, setName] = useState(initial.name);
  const [brand, setBrand] = useState(initial.brand ?? '');
  const [size, setSize] = useState(initial.size ?? '');
  const [quantity, setQuantity] = useState(String(initial.quantity));
  const [unit, setUnit] = useState<SupplyUnit>(initial.unit);
  const [low, setLow] = useState(String(initial.low_threshold));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { data: brands } = useLoad(listBrands, []);

  const kinds = BRAND_KINDS[category] ?? [];
  const brandOptions = (brands ?? [])
    .filter((b) => kinds.includes(b.kind))
    .map((b) => (locale === 'ar' ? b.name_ar : b.name_en))
    .filter((v, i, a) => a.indexOf(v) === i);

  async function submit() {
    const q = toInt(quantity);
    const l = toInt(low);
    if (!name.trim()) return setError(t.invalidSupplyName);
    if (!(q >= 0 && q <= 9999) || !(l >= 0 && l <= 999)) return setError(t.somethingWrong);
    setError(null);
    setBusy(true);
    try {
      await onSubmit({ category, name: name.trim(), brand: brand.trim() || null, size: size.trim() || null, quantity: q, unit, low_threshold: l });
    } catch {
      setError(t.somethingWrong);
      setBusy(false);
    }
  }

  return (
    <>
      <Field label={t.supplyName} placeholder={t.supplyNamePlaceholder} value={name} onChangeText={setName} maxLength={80} testID="supply-name" />
      <Choice label={t.category} value={category} onChange={setCategory} options={SUPPLY_CATEGORIES.map((c) => ({ value: c, label: t[`cat_${c}`] }))} />
      <Field label={t.brand} value={brand} onChangeText={setBrand} maxLength={60} />
      {brandOptions.length > 0 ? <Choice value={brand} onChange={setBrand} options={brandOptions.map((b) => ({ value: b, label: b }))} /> : null}
      <Field label={t.sizeType} value={size} onChangeText={setSize} maxLength={40} />
      <Field label={t.quantity} value={quantity} onChangeText={setQuantity} keyboardType="number-pad" maxLength={4} testID="supply-qty" />
      <Choice label={t.unit} value={unit} onChange={setUnit} options={SUPPLY_UNITS.map((u) => ({ value: u, label: t[`unit_${u}`] }))} />
      <Field label={t.lowAt} value={low} onChangeText={setLow} keyboardType="number-pad" maxLength={3} testID="supply-low" />
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Button title={t.save} onPress={submit} loading={busy} testID="supply-save" />
    </>
  );
}
