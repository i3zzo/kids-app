// Suggested supplies for one child's age (and, for clothing, milk and
// diapers only, gender). Brands are shown alphabetically with no promotion,
// and formula always carries the breastfeeding / ask-your-doctor notice.
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Card, ErrorText, Muted, Row, Screen, Skeleton, Txt } from '@/components/ui';
import { addSuggestedSupplies, getChild, listBrands, listSuggestions, listSupplies, SUPPLY_CATEGORIES, type SupplySuggestion } from '@/lib/api';
import { ageLabel, ageParts } from '@/lib/dates';
import { useI18n } from '@/lib/i18n';
import { useFamily } from '@/lib/session';
import { useLoad } from '@/lib/useLoad';
import { colors, space } from '@/theme';

export default function Suggestions() {
  const { t, locale } = useI18n();
  const { familyId } = useFamily();
  const { child: childId } = useLocalSearchParams<{ child: string }>();
  const { data, error, reload } = useLoad(async () => {
    const child = await getChild(childId);
    const { years, months } = ageParts(child.birth_date);
    // Three independent requests, sent together.
    const [suggestions, brands, items] = await Promise.all([listSuggestions(years * 12 + months, child.gender), listBrands(), listSupplies(childId)]);
    return { child, suggestions, brands, added: new Set(items.map((i) => i.suggestion_id).filter(Boolean)) };
  }, [childId]);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  if (error) return <Screen><ErrorText>{t.somethingWrong}</ErrorText><Button title={t.retry} onPress={reload} /></Screen>;
  if (!data) return <Screen><Skeleton lines={6} /></Screen>;

  const name = (s: SupplySuggestion) => (locale === 'ar' ? s.name_ar : s.name_en);
  async function add(list: SupplySuggestion[], key: string) {
    setBusy(key);
    setFailed(false);
    try {
      const todo = list.filter((s) => !data!.added.has(s.id));
      await addSuggestedSupplies(
        familyId,
        childId,
        todo.map((s) => ({ category: s.category, name: name(s), brand: null, size: null, quantity: 0, unit: s.default_unit, low_threshold: s.default_low, suggestion_id: s.id })),
      );
      for (const s of todo) data!.added.add(s.id);
    } catch {
      setFailed(true);
    } finally {
      setBusy(null);
    }
  }
  const remaining = data.suggestions.filter((s) => !data.added.has(s.id));

  return (
    <Screen>
      <Txt style={{ fontSize: 18, fontWeight: '700' }}>
        {t.suggestedFor} {ageLabel(data.child.birth_date, locale)} · {data.child.first_name}
      </Txt>
      {remaining.length > 1 ? <Button title={`${t.addAllSuggested} (${remaining.length})`} loading={busy === 'all'} onPress={() => add(remaining, 'all')} testID="add-all" /> : null}
      {failed ? <ErrorText>{t.somethingWrong}</ErrorText> : null}
      {SUPPLY_CATEGORIES.map((cat) => {
        const list = data.suggestions.filter((s) => s.category === cat);
        if (!list.length) return null;
        return (
          <View key={cat} style={{ gap: space.sm }}>
            <Txt style={{ fontSize: 18, fontWeight: '700' }} accessibilityRole="header">{t[`cat_${cat}`]}</Txt>
            {list.map((s) => {
              const isAdded = data.added.has(s.id);
              const brands = s.brand_kind ? data.brands.filter((b) => b.kind === s.brand_kind) : [];
              const hint = locale === 'ar' ? s.hint_ar : s.hint_en;
              return (
                <Card key={s.id} style={s.is_formula ? { borderColor: colors.sand } : undefined}>
                  <Row>
                    <Txt style={{ fontWeight: '700', flex: 1 }}>{name(s)}</Txt>
                    {isAdded ? (
                      <Muted>✓ {t.added}</Muted>
                    ) : (
                      <View style={{ minWidth: 90 }}>
                        <Button title={t.add} variant="secondary" loading={busy === s.id} onPress={() => add([s], s.id)} />
                      </View>
                    )}
                  </Row>
                  {hint ? <Txt style={s.is_formula ? { fontWeight: '600' } : { color: colors.muted }}>{hint}</Txt> : null}
                  {brands.length ? (
                    <Muted>
                      {t.brandsInKuwait}: {brands.map((b) => (locale === 'ar' ? b.name_ar : b.name_en)).sort((a, b) => a.localeCompare(b, locale)).join(locale === 'ar' ? '، ' : ', ')}
                    </Muted>
                  ) : null}
                </Card>
              );
            })}
          </View>
        );
      })}
      <Muted>{t.brandsNote}</Muted>
    </Screen>
  );
}
