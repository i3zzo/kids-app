// "Are you sure?" dialog that works on phones and on the web preview.
import { Alert, Platform } from 'react-native';
import type { Strings } from './i18n/strings';

export function confirm(message: string, t: Strings): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(message));
  return new Promise((resolve) =>
    Alert.alert('', message, [
      { text: t.cancel, style: 'cancel', onPress: () => resolve(false) },
      { text: t.continue, style: 'destructive', onPress: () => resolve(true) },
    ]),
  );
}
