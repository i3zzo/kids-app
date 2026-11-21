// Root of the app. Decides which group of screens a parent can reach:
//   signed out           → (auth): language, phone, code
//   signed in, no family → (onboarding): create/join family, first child
//   ready                → (tabs) + detail screens
// This only controls navigation. Data protection lives in the database.
import { LocaleProvider, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Button, Txt } from '@/components/ui';
import { I18nProvider, useI18n } from '@/lib/i18n';
import { SessionProvider, useSession } from '@/lib/session';
import { isConfigured } from '@/lib/supabase';
import { colors } from '@/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <I18nProvider>
        <SessionProvider>
          <StatusBar style="dark" />
          <Gate />
        </SessionProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}

function Gate() {
  const { t, isRTL, hasChosen } = useI18n();
  const { session, membership, hasChildren, loadFailed, refresh } = useSession();

  if (!isConfigured) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: colors.sandLight }}>
        <Txt>{t.notConfigured}</Txt>
      </View>
    );
  }

  if (session && loadFailed) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 16, backgroundColor: colors.sandLight }}>
        <Txt style={{ textAlign: 'center' }}>{t.offline}</Txt>
        <Button title={t.retry} onPress={() => refresh().catch(() => {})} testID="retry-load" />
      </View>
    );
  }

  const loading = hasChosen === null || session === undefined || (session && (membership === undefined || (membership && hasChildren === undefined)));
  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.sandLight }}>
        <ActivityIndicator color={colors.teal} size="large" accessibilityLabel={t.loading} />
      </View>
    );
  }

  const signedIn = Boolean(session);
  const ready = signedIn && Boolean(membership) && Boolean(hasChildren);

  return (
    <LocaleProvider direction={isRTL ? 'rtl' : 'ltr'}>
      <Stack
        screenOptions={{
          headerTintColor: colors.tealDark,
          headerStyle: { backgroundColor: colors.sandLight },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.sandLight },
          headerBackButtonDisplayMode: 'minimal',
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={signedIn && !ready}>
          <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={ready}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="child/new" options={{ title: t.addChild, presentation: 'modal' }} />
          <Stack.Screen name="child/[id]" options={{ title: t.editChild }} />
          <Stack.Screen name="event/new" options={{ title: t.addEvent, presentation: 'modal' }} />
          <Stack.Screen name="event/[id]" options={{ title: t.editEvent }} />
          <Stack.Screen name="vaccines/[childId]" options={{ title: t.vaccineSchedule }} />
          <Stack.Screen name="dose/[id]" options={{ title: t.vaccine }} />
          <Stack.Screen name="supply/new" options={{ title: t.addSupply, presentation: 'modal' }} />
          <Stack.Screen name="supply/[id]" options={{ title: t.editSupply }} />
          <Stack.Screen name="supplies/suggestions" options={{ title: t.suggestedItems }} />
          <Stack.Screen name="settings/notifications" options={{ title: t.notifications }} />
        </Stack.Protected>
      </Stack>
    </LocaleProvider>
  );
}
