// The privacy notice. Open to everyone, signed in or not, so a parent can
// read it before agreeing to it.
import { View } from 'react-native';
import { Muted, Screen, Txt } from '@/components/ui';
import { PRIVACY_VERSION } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { privacyNotice } from '@/lib/i18n/privacyNotice';
import { space } from '@/theme';

export default function PrivacyNotice() {
  const { t, locale } = useI18n();
  return (
    <Screen>
      <Muted>{t.privacyDraft} · {PRIVACY_VERSION}</Muted>
      {privacyNotice[locale].map((s) => (
        <View key={s.title} style={{ gap: space.xs }}>
          <Txt style={{ fontSize: 18, fontWeight: '700' }} accessibilityRole="header">{s.title}</Txt>
          <Txt>{s.body}</Txt>
        </View>
      ))}
    </Screen>
  );
}
