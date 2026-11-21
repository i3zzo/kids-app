// Push notifications on the phone: ask permission (only when the parent taps
// "Turn on reminders"), get this phone's Expo push token, and give it to the
// database (register_device). The database decides what to send and when —
// see supabase/migrations/20261121140000_reminders.sql.
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { registerDevice, unregisterDevice } from './api';

const TOKEN_KEY = 'yahal.pushToken';

export type PushStatus = 'unsupported' | 'granted' | 'denied' | 'undetermined';

// Show reminders even while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

/** The EAS project id (set by `eas init` in app.json → extra.eas.projectId). Push tokens need it. */
function projectId(): string | undefined {
  return Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

export async function pushStatus(): Promise<PushStatus> {
  if (!Device.isDevice || !projectId()) return 'unsupported';
  const { status, canAskAgain } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return 'granted';
  return status === 'denied' && !canAskAgain ? 'denied' : 'undetermined';
}

async function register(locale: 'ar' | 'en') {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('reminders', {
      name: locale === 'ar' ? 'التذكيرات' : 'Reminders',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: projectId() });
  await registerDevice(token, Platform.OS === 'ios' ? 'ios' : 'android', locale);
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

/** Called when the parent taps "Turn on reminders". Returns the new status. */
export async function enablePush(locale: 'ar' | 'en'): Promise<PushStatus> {
  if ((await pushStatus()) === 'unsupported') return 'unsupported';
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return 'denied';
  await register(locale);
  return 'granted';
}

/** On app start and language change: refresh the token if permission was already given. Never prompts. */
export async function syncPush(locale: 'ar' | 'en') {
  if ((await pushStatus()) === 'granted') await register(locale);
}

/** Before signing out: stop sending this account's reminders to this phone. */
export async function forgetThisPhone() {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  if (!token) return;
  await unregisterDevice(token).catch(() => {});
  await AsyncStorage.removeItem(TOKEN_KEY);
}

/** Tapping a reminder opens the right screen (only paths inside the app). */
export function useNotificationTaps() {
  const response = Notifications.useLastNotificationResponse();
  useEffect(() => {
    const url = response?.notification.request.content.data?.url;
    if (typeof url === 'string' && (/^\/(dose|event)\/[0-9a-f-]{36}$/.test(url) || url === '/supplies')) router.push(url);
  }, [response]);
}
