// Tips for one child's age, by section, from our reviewed library. Each
// section has an optional "Personalise with AI" button: the server rewrites
// the reviewed tips for this child, knowing only the age in months and gender.
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Button, Card, Dot, ErrorText, Muted, Row, Screen, Skeleton, Txt } from '@/components/ui';
import { getChild, listTips, streamTipsAI, type AiError } from '@/lib/api';
import { ageLabel, ageParts } from '@/lib/dates';
import { useI18n } from '@/lib/i18n';
import { TIP_SECTIONS, type TipSection } from '@/lib/tips';
import { useLoad } from '@/lib/useLoad';
import { colors, space } from '@/theme';

type AiState = { section: TipSection; text: string; busy: boolean; error: AiError | null };

export default function Tips() {
  const { t, locale } = useI18n();
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const { data, error, reload } = useLoad(async () => {
    const child = await getChild(childId);
    const { years, months } = ageParts(child.birth_date);
    return { child, tips: await listTips(years * 12 + months, child.gender) };
  }, [childId]);
  const [ai, setAi] = useState<AiState | null>(null);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);

  if (error) return <Screen><ErrorText>{t.somethingWrong}</ErrorText><Button title={t.retry} onPress={reload} /></Screen>;
  if (!data) return <Screen><Skeleton lines={6} /></Screen>;

  async function personalise(section: TipSection) {
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setAi({ section, text: '', busy: true, error: null });
    try {
      await streamTipsAI(childId, section, locale, (text) => setAi((a) => (a && a.section === section ? { ...a, text } : a)), ctrl.signal);
      setAi((a) => (a && a.section === section ? { ...a, busy: false } : a));
    } catch (e) {
      if (ctrl.signal.aborted) return setAi((a) => (a && a.section === section ? { ...a, busy: false } : a));
      const code = ((e as Error).message as AiError) ?? 'failed';
      setAi((a) => (a && a.section === section ? { ...a, busy: false, error: ['daily_limit', 'not_configured'].includes(code) ? code : 'failed' } : a));
    }
  }

  const aiError = (e: AiError) => (e === 'daily_limit' ? t.aiDailyLimit : e === 'not_configured' ? t.aiNotConfigured : t.somethingWrong);

  return (
    <Screen>
      <Row>
        <Dot color={data.child.color} />
        <Txt style={{ fontSize: 18, fontWeight: '700', flex: 1 }}>
          {t.tipsFor} {ageLabel(data.child.birth_date, locale)} · {data.child.first_name}
        </Txt>
      </Row>
      <Muted>{t.tipsDisclaimer}</Muted>
      {data.tips.length === 0 ? <Muted>{t.noTips}</Muted> : null}
      {TIP_SECTIONS.map((sec) => {
        const list = data.tips.filter((tip) => tip.section === sec);
        if (!list.length) return null;
        const mine = ai?.section === sec ? ai : null;
        return (
          <View key={sec} style={{ gap: space.sm }} testID={`tips-${sec}`}>
            <Txt style={{ fontSize: 18, fontWeight: '700' }} accessibilityRole="header">{t[`sec_${sec}`]}</Txt>
            {list.map((tip) => (
              <Card key={tip.id}>
                <Txt style={{ fontWeight: '700' }}>{locale === 'ar' ? tip.title_ar : tip.title_en}</Txt>
                <Txt>{locale === 'ar' ? tip.body_ar : tip.body_en}</Txt>
              </Card>
            ))}
            {mine ? (
              <Card style={{ borderColor: colors.teal }} testID={`ai-${sec}`}>
                {mine.text ? <Txt>{mine.text}</Txt> : mine.busy ? <Muted>{t.aiWriting}</Muted> : null}
                {mine.error ? <ErrorText>{aiError(mine.error)}</ErrorText> : null}
                {mine.text && !mine.busy ? <Muted>{t.aiLabel}</Muted> : null}
                {mine.busy ? <Button title={t.stop} variant="secondary" onPress={() => abort.current?.abort()} /> : null}
              </Card>
            ) : (
              <Button title={`✨ ${t.personaliseAI}`} variant="secondary" disabled={ai?.busy} onPress={() => personalise(sec)} testID={`ai-btn-${sec}`} />
            )}
          </View>
        );
      })}
      <Muted>{t.aiPrivacy}</Muted>
    </Screen>
  );
}
