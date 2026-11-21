// One government guide: steps with documents and links, and a tick box per
// step for the chosen child (saved for both parents). Ticking is optimistic:
// it changes at once and goes back if saving fails.
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { Button, Card, ErrorText, Muted, Row, Screen, Skeleton, Title, Txt } from '@/components/ui';
import { getGuide, listChildren, listGuideProgress, setGuideStepDone } from '@/lib/api';
import { formatDay, useI18n } from '@/lib/i18n';
import { useFamily } from '@/lib/session';
import { useLoad } from '@/lib/useLoad';
import { colors, space } from '@/theme';

export default function GuideScreen() {
  const { t, locale } = useI18n();
  const { familyId } = useFamily();
  const { id, child } = useLocalSearchParams<{ id: string; child?: string }>();
  const { data, error, reload } = useLoad(
    () => Promise.all([getGuide(id), child ? listGuideProgress(child) : Promise.resolve(new Set<string>()), listChildren()]),
    [id, child],
  );
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [saveError, setSaveError] = useState(false);

  if (error) return <Screen><ErrorText>{t.somethingWrong}</ErrorText><Button title={t.retry} onPress={reload} /></Screen>;
  if (!data) return <Screen><Skeleton lines={6} /></Screen>;
  const [guide, done, children] = data;
  const childName = children.find((c) => c.id === child)?.first_name;
  const isDone = (stepId: string) => overrides[stepId] ?? done.has(stepId);
  const count = guide.guide_steps.filter((s) => isDone(s.id)).length;

  async function toggle(stepId: string) {
    if (!child) return;
    const next = !isDone(stepId);
    setSaveError(false);
    setOverrides((o) => ({ ...o, [stepId]: next }));
    try {
      await setGuideStepDone(familyId, child, stepId, next);
      if (next) done.add(stepId);
      else done.delete(stepId);
    } catch {
      setSaveError(true);
    } finally {
      setOverrides((o) => {
        const { [stepId]: _, ...rest } = o;
        return rest;
      });
    }
  }

  return (
    <Screen>
      <Title>{locale === 'ar' ? guide.title_ar : guide.title_en}</Title>
      <Txt>{locale === 'ar' ? guide.summary_ar : guide.summary_en}</Txt>
      {guide.last_verified_on ? (
        <Muted>{t.verifiedOn}: {formatDay(guide.last_verified_on, locale)}</Muted>
      ) : (
        <Card style={{ backgroundColor: colors.sand, borderColor: colors.sand }}>
          <Txt style={{ fontWeight: '600' }}>⚠️ {t.notVerified}</Txt>
        </Card>
      )}
      {childName ? <Muted>{t.guideFor} {childName}: {count}/{guide.guide_steps.length} {t.stepsDone}</Muted> : null}
      {saveError ? <ErrorText>{t.somethingWrong}</ErrorText> : null}
      {guide.guide_steps.map((s) => {
        const checked = isDone(s.id);
        const docs = locale === 'ar' ? s.documents_ar : s.documents_en;
        return (
          <Card key={s.id}>
            <Row>
              {child ? (
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked }}
                  accessibilityLabel={locale === 'ar' ? s.title_ar : s.title_en}
                  onPress={() => toggle(s.id)}
                  hitSlop={8}
                  testID={`step-${s.position}`}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    borderWidth: 2,
                    borderColor: colors.teal,
                    backgroundColor: checked ? colors.teal : colors.white,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {checked ? <Text style={{ color: colors.white, fontWeight: '700' }}>✓</Text> : null}
                </Pressable>
              ) : (
                <Txt style={{ fontWeight: '700' }}>{s.position}.</Txt>
              )}
              <Txt style={{ fontWeight: '700', flex: 1, textDecorationLine: checked ? 'line-through' : 'none' }}>{locale === 'ar' ? s.title_ar : s.title_en}</Txt>
            </Row>
            <Txt>{locale === 'ar' ? s.body_ar : s.body_en}</Txt>
            {docs.length ? (
              <View style={{ gap: 2 }}>
                <Txt style={{ fontWeight: '600' }}>{t.documents}:</Txt>
                {docs.map((d) => (
                  <Muted key={d}>• {d}</Muted>
                ))}
              </View>
            ) : null}
            {s.link_url ? <Button title={t.openLink} variant="secondary" onPress={() => Linking.openURL(s.link_url!)} /> : null}
          </Card>
        );
      })}
      {guide.source_url ? <Button title={`${t.officialSource} ↗`} variant="secondary" onPress={() => Linking.openURL(guide.source_url!)} /> : null}
      <View style={{ height: space.lg }} />
    </Screen>
  );
}
