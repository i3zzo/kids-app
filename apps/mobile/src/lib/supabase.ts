// The one place the app talks to Supabase (sign-in + database).
//
// Only the project URL and the public "anon" key come in, from environment
// variables (see .env.example). The anon key is safe to ship in an app: it
// only lets a request in the door. What each parent may read or change is
// decided by Row Level Security rules inside the database
// (supabase/migrations/), never by this app.
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import { secureSessionStore } from './secureSessionStore';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const isConfigured = Boolean(url && anonKey);

// Release builds must talk to the server over HTTPS only. (Development builds
// may use http:// to reach the Supabase running on your computer; so may the
// web preview when it points at this computer.)
const localWebPreview = Platform.OS === 'web' && /^http:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(url ?? '');
if (!__DEV__ && url && !url.startsWith('https://') && !localWebPreview) {
  throw new Error('EXPO_PUBLIC_SUPABASE_URL must start with https:// in release builds');
}

export const supabase = createClient(url ?? 'http://missing-config.invalid', anonKey ?? 'missing', {
  auth: {
    // Phones: encrypted session, key in Keychain/Keystore.
    // Web preview: the browser's own storage (default).
    storage: Platform.OS === 'web' ? undefined : secureSessionStore,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Refresh the session only while the app is open (Supabase's recommended setup for React Native).
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
