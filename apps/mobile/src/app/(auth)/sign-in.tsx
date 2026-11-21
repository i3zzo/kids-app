// Step 1 of sign-in: the parent types their Kuwaiti mobile number.
// Supabase Auth sends a one-time code by SMS. We never handle passwords.
import { router } from 'expo-router';
import { useState } from 'react';
import { Button, Field, Muted, Screen, Title } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import { toKuwaitE164 } from '@/lib/phone';
import { supabase } from '@/lib/supabase';
import { View } from 'react-native';
import { space } from '@/theme';

export default function SignIn() {
  const { t, locale, setLocale } = useI18n();
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function send() {
    const e164 = toKuwaitE164(phone);
    if (!e164) return setError(t.invalidPhone);
    setError(null);
    setBusy(true);
    const { error: err } = await supabase.auth.signInWithOtp({ phone: e164 });
    setBusy(false);
    if (err) return setError(t.somethingWrong);
    router.push({ pathname: '/verify', params: { phone: e164 } });
  }

  return (
    <Screen>
      <View style={{ marginTop: space.xxl, gap: space.sm }}>
        <Title>{t.signInTitle}</Title>
        <Muted>{t.signInHint}</Muted>
      </View>
      <Field
        label={`${t.phoneLabel} (+965)`}
        placeholder={t.phonePlaceholder}
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        textContentType="telephoneNumber"
        autoComplete="tel"
        maxLength={16}
        error={error}
        testID="phone"
        style={{ textAlign: 'left', writingDirection: 'ltr' }}
      />
      <Button title={t.sendCode} onPress={send} loading={busy} testID="send-code" />
      <Button
        variant="link"
        title={locale === 'ar' ? 'English' : 'العربية'}
        onPress={() => setLocale(locale === 'ar' ? 'en' : 'ar')}
      />
    </Screen>
  );
}
