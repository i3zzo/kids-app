// The bottom tab bar. More tabs (Supplies, Explore) come in later build steps.
import { Tabs } from 'expo-router/js-tabs';
import { Platform, Text, type ColorValue } from 'react-native';
import { useI18n } from '@/lib/i18n';
import { colors } from '@/theme';

const icon = (glyph: string) => ({ color }: { color: ColorValue }) => (
  <Text style={{ fontSize: 18, lineHeight: 22, color }} accessibilityElementsHidden importantForAccessibility="no">
    {glyph}
  </Text>
);

export default function TabsLayout() {
  const { t, isRTL } = useI18n();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.teal,
        tabBarInactiveTintColor: colors.muted,
        // In Arabic the tab order is mirrored (Home on the right).
        tabBarStyle: { backgroundColor: colors.white, borderTopColor: colors.line, direction: isRTL ? 'rtl' : 'ltr', ...(Platform.OS === 'web' ? { height: 62 } : null) },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        headerStyle: { backgroundColor: colors.sandLight },
        headerShadowVisible: false,
        headerTitleStyle: { color: colors.ink, fontWeight: '700' },
        sceneStyle: { backgroundColor: colors.sandLight },
      }}
    >
      <Tabs.Screen name="home" options={{ title: t.tabHome, tabBarIcon: icon('⌂') }} />
      <Tabs.Screen name="calendar" options={{ title: t.tabCalendar, tabBarIcon: icon('▦') }} />
      <Tabs.Screen name="family" options={{ title: t.tabFamily, tabBarIcon: icon('☺') }} />
    </Tabs>
  );
}
