// First launch: pick Arabic or English.
import { router } from 'expo-router';
import { Image, View } from 'react-native';
import { Button, Screen, Title, Txt } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import { space } from '@/theme';

export default function Language() {
  const { t, setLocale } = useI18n();
  const pick = (l: 'ar' | 'en') => {
    setLocale(l);
    router.replace('/sign-in');
  };
  return (
    <Screen>
      <View style={{ alignItems: 'center', gap: space.md, marginTop: space.xxl }}>
        <Image source={require('../../../assets/logo.webp')} style={{ width: 112, height: 112, borderRadius: 28 }} accessibilityIgnoresInvertColors alt="Yahal" />
        <Title>ياهل · Yahal</Title>
        <Txt style={{ textAlign: 'center' }}>{t.chooseLanguage} · Choose your language</Txt>
      </View>
      <Button title="العربية" onPress={() => pick('ar')} testID="lang-ar" />
      <Button title="English" variant="secondary" onPress={() => pick('en')} testID="lang-en" />
    </Screen>
  );
}
