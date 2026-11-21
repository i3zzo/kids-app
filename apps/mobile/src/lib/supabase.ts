// The one place the app talks to Supabase (sign-in + database).
//
// Only the project URL and the public "anon" key come in, from environment
// variables (see .env.example). The anon key is safe to ship in an app: it
// only lets a request in the door. What each parent may read or change is
// decided by Row Level Security rules inside the database
// (supabase/migrations/), never by this app.
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const isConfigured = Boolean(url && anonKey);

export const supabase = createClient(url ?? 'http://missing-config.invalid', anonKey ?? 'missing', {
  auth: {
    // Keeps the parent signed in between app launches.
    storage: Platform.OS === 'web' && typeof window === 'undefined' ? undefined : AsyncStorage,
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
