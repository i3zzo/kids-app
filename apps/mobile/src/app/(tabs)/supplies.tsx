// Supplies: one child's list by category, with quick − / + buttons, and a
// link to the suggested list for the child's age.
// The − / + buttons are "optimistic": the number changes at once, and goes
// back (with a message) if the server refuses. Low-risk, so the screen feels
// instant (project performance standard, item 10).
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Choice, ErrorText, Muted, Row, Screen, Skeleton, Txt } from '@/components/ui';
import { listChildren, listSupplies, SUPPLY_CATEGORIES, updateSupply, type SupplyItem } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useLoad } from '@/lib/useLoad';
import { colors, space } from '@/theme';

export default function Supplies() {
  const { t, isRTL } = useI18n();
  const { data: children, error: childErr, reload: reloadChildren } = useLoad(listChildren, []);
  const [childId, setChildId] = useState<string | null>(null);
  useEffect(() => {
    if (children?.length && !children.some((c) => c.id === childId)) setChildId(children[0].id);
  }, [children, childId]);

  const { data: items, error, reload } = useLoad(() => (childId ? listSupplies(childId) : Promise.resolve(undefined)), [childId]);
  // Optimistic quantities, keyed by item id, until the server confirms.
  const [pending, setPending] = useState<Record<string, number>>({});
  const [saveError, setSaveError] = useState(false);

  async function change(item: SupplyItem, delta: number) {
    const current = pending[item.id] ?? item.quantity;
    const next = Math.max(0, Math.min(9999, current + delta));
    if (next === current) return;
    setSaveError(false);
    setPending((p) => ({ ...p, [item.id]: next }));
    try {
      await updateSupply(item.id, { quantity: next });
      item.quantity = next; // keep the confirmed value
      item.is_low = next <= item.low_threshold;
    } catch {
      setSaveError(true);
    } finally {
      setPending((p) => {
        const { [item.id]: _, ...rest } = p;
        return rest;
      });
    }
  }

  if (childErr) return <Screen><ErrorText>{t.somethingWrong}</ErrorText><Button title={t.retry} onPress={reloadChildren} /></Screen>;
  if (!children || !childId) return <Screen><Skeleton lines={4} /></Screen>;

  return (
    <View style={{ flex: 1 }}>
      <Screen>
        {children.length > 1 ? (
          <Choice value={childId} onChange={setChildId} options={children.map((c) => ({ value: c.id, label: c.first_name }))} />
        ) : null}
        <Button title={`✨ ${t.suggestedItems}`} variant="secondary" onPress={() => router.push({ pathname: '/supplies/suggestions', params: { child: childId } })} testID="open-suggestions" />
        {saveError ? <ErrorText>{t.somethingWrong}</ErrorText> : null}
        {error ? (
          <>
            <ErrorText>{t.somethingWrong}</ErrorText>
            <Button title={t.retry} variant="secondary" onPress={reload} />
          </>
        ) : !items ? (
          <Skeleton lines={4} />
        ) : items.length === 0 ? (
          <Muted>{t.noSupplies}</Muted>
        ) : (
          SUPPLY_CATEGORIES.map((cat) => {
            const list = items.filter((i) => i.category === cat);
            if (!list.length) return null;
            return (
              <View key={cat} style={{ gap: space.sm }}>
                <Txt style={{ fontSize: 18, fontWeight: '700' }} accessibilityRole="header">{t[`cat_${cat}`]}</Txt>
                {list.map((item) => {
                  const qty = pending[item.id] ?? item.quantity;
                  const low = qty <= item.low_threshold;
                  return (
                    <Card key={item.id} onPress={() => router.push(`/supply/${item.id}`)} testID={`supply-${item.name}`}>
                      <Row>
                        <View style={{ flex: 1, gap: 2 }}>
                          <Txt style={{ fontWeight: '700' }}>{item.name}</Txt>
                          {item.brand || item.size ? <Muted>{[item.brand, item.size].filter(Boolean).join(' · ')}</Muted> : null}
                          {low ? (
                            <Txt style={{ color: qty === 0 ? colors.danger : colors.warning, fontWeight: '700', fontSize: 13 }}>
                              {qty === 0 ? t.finished : t.runningLow}
                            </Txt>
                          ) : null}
                        </View>
                        <Row style={isRTL ? { flexDirection: 'row-reverse' } : undefined} gap={space.xs}>
                          <Step label={t.decrease} glyph="−" onPress={() => change(item, -1)} />
                          <Text style={s.qty} accessibilityLabel={`${t.quantity}: ${qty}`}>
                            {qty}
                            <Text style={s.unit}> {t[`unit_${item.unit}`]}</Text>
                          </Text>
                          <Step label={t.increase} glyph="+" onPress={() => change(item, 1)} testID={`inc-${item.name}`} />
                        </Row>
                      </Row>
                    </Card>
                  );
                })}
              </View>
            );
          })
        )}
        <View style={{ height: 72 }} />
      </Screen>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t.addSupply}
        testID="add-supply"
        onPress={() => router.push({ pathname: '/supply/new', params: { child: childId } })}
        style={[s.fab, isRTL ? { left: space.xl } : { right: space.xl }]}
      >
        <Text style={{ color: colors.white, fontSize: 30, lineHeight: 32 }}>+</Text>
      </Pressable>
    </View>
  );
}

function Step({ label, glyph, onPress, testID }: { label: string; glyph: string; onPress: () => void; testID?: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={s.step} hitSlop={6} testID={testID}>
      <Text style={s.stepTxt}>{glyph}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  step: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.tealLight, alignItems: 'center', justifyContent: 'center' },
  stepTxt: { fontSize: 22, color: colors.tealDark, lineHeight: 24, fontWeight: '700' },
  qty: { minWidth: 48, textAlign: 'center', fontSize: 18, fontWeight: '700', color: colors.ink },
  unit: { fontSize: 11, fontWeight: '400', color: colors.muted },
  fab: {
    position: 'absolute',
    bottom: space.xl,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
});
