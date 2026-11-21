// Step 2 of sign-in: the parent types the 6-digit code from the SMS.
// When Supabase confirms it, the root layout moves them on automatically.
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, ErrorText, Field, Muted, Screen, Title } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import { normaliseDigits } from '@/lib/phone';
import { supabase } from '@/lib/supabase';
import { space } from '@/theme';

export default function Verify() {
  const { t } = useI18n();
  const { phone, captcha } = useLocalSearchParams<{ phone: string; captcha?: string }>();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resent, setResent] = useState(false);

  async function verify() {
    const token = normaliseDigits(code).replace(/\D/g, '');
    if (token.length !== 6) return setError(t.wrongCode);
    setError(null);
    setBusy(true);
    const { error: err } = await supabase.auth.verifyOtp({ phone: phone!, token, type: 'sms' });
    setBusy(false);
    if (err) setError(t.wrongCode);
  }

  async function resend() {
    // With the bot check on, a new check is needed: go back to the phone screen.
    if (captcha) return router.back();
    setResent(true);
    await supabase.auth.signInWithOtp({ phone: phone! });
  }

  return (
    <Screen>
      <View style={{ marginTop: space.xxl, gap: space.sm }}>
        <Title>{t.verifyTitle}</Title>
        <Muted>
          {t.verifyHint} {'⁦'}{phone}{'⁩'}
        </Muted>
      </View>
      <Field
        label={t.codeLabel}
        value={code}
        onChangeText={setCode}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={6}
        autoFocus
        testID="otp"
        style={{ textAlign: 'center', letterSpacing: 8, fontSize: 24 }}
      />
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Button title={t.verify} onPress={verify} loading={busy} testID="verify" />
      <Button variant="link" title={t.resend} onPress={resend} disabled={resent} />
      <Button variant="link" title={t.changeNumber} onPress={() => router.back()} />
    </Screen>
  );
}
