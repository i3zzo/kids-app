// New parent: create a family (and accept the privacy notice),
// or join the other parent's family with an invite code.
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button, ErrorText, Field, Muted, Row, Screen, Title, Txt } from '@/components/ui';
import { acceptInvite, createFamily } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { colors, space } from '@/theme';

export default function CreateFamily() {
  const { t } = useI18n();
  const { refresh } = useSession();
  const [name, setName] = useState('');
  const [consent, setConsent] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'create' | 'join' | null>(null);

  async function create() {
    if (!name.trim()) return setError(t.familyName);
    if (!consent) return setError(t.consentRequired);
    setError(null);
    setBusy('create');
    try {
      await createFamily(name.trim());
      await refresh();
      router.replace('/first-child');
    } catch {
      setError(t.somethingWrong);
    } finally {
      setBusy(null);
    }
  }

  async function join() {
    setJoinError(null);
    setBusy('join');
    try {
      const familyId = await acceptInvite(code);
      if (!familyId) {
        setJoinError(t.invalidInvite);
        return;
      }
      await refresh(); // the root layout takes the parent to Home
    } catch (e) {
      const c = (e as { code?: string }).code;
      setJoinError(c === '23514' ? t.familyFull : c === '54000' ? t.tooManyTries : t.invalidInvite);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen>
      <View style={{ marginTop: space.xl }}>
        <Title>{t.createFamilyTitle}</Title>
      </View>
      <Field label={t.familyName} placeholder={t.familyNamePlaceholder} value={name} onChangeText={setName} maxLength={60} testID="family-name" />
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: consent }} onPress={() => setConsent(!consent)} testID="consent">
        <Row style={{ alignItems: 'flex-start' }}>
          <View
            style={{
              width: 26,
              height: 26,
              borderRadius: 6,
              borderWidth: 2,
              borderColor: colors.teal,
              backgroundColor: consent ? colors.teal : colors.white,
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: 2,
            }}
          >
            {consent ? <Txt style={{ color: colors.white, fontWeight: '700' }}>✓</Txt> : null}
          </View>
          <Txt style={{ flex: 1, fontSize: 15 }}>{t.consentText}</Txt>
        </Row>
      </Pressable>
      <Button title={t.readPrivacyNotice} variant="link" onPress={() => router.push('/privacy')} testID="read-privacy" />
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Button title={t.createFamily} onPress={create} loading={busy === 'create'} disabled={busy !== null} testID="create-family" />

      <Muted style={{ textAlign: 'center', marginTop: space.lg }}>— {t.or} —</Muted>
      <Txt style={{ fontWeight: '600' }}>{t.haveInvite}</Txt>
      <Field
        label={t.inviteCode}
        value={code}
        onChangeText={(v) => setCode(v.toUpperCase())}
        autoCapitalize="characters"
        maxLength={8}
        error={joinError}
        style={{ textAlign: 'center', letterSpacing: 4 }}
      />
      <Button title={t.joinFamily} variant="secondary" onPress={join} loading={busy === 'join'} disabled={busy !== null || code.length < 8} />
    </Screen>
  );
}
