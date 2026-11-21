// Where the login session (access + refresh token) is kept on the phone.
//
// The session is encrypted with AES-256 before it is written to normal app
// storage. The encryption key itself lives in the phone's secure hardware
// store (iOS Keychain / Android Keystore) via expo-secure-store, and never
// leaves this device (not even in backups). This is Supabase's recommended
// "LargeSecureStore" pattern: SecureStore alone can't hold a full session
// (Android limits values to about 2 KB).
import 'react-native-get-random-values';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as aesjs from 'aes-js';
import * as SecureStore from 'expo-secure-store';

const keyOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

async function encrypt(storageKey: string, value: string): Promise<string> {
  const keyBytes = crypto.getRandomValues(new Uint8Array(256 / 8));
  const cipher = new aesjs.ModeOfOperation.ctr(keyBytes, new aesjs.Counter(1));
  const encrypted = cipher.encrypt(aesjs.utils.utf8.toBytes(value));
  await SecureStore.setItemAsync(storageKey, aesjs.utils.hex.fromBytes(keyBytes), keyOptions);
  return aesjs.utils.hex.fromBytes(encrypted);
}

async function decrypt(storageKey: string, value: string): Promise<string | null> {
  const keyHex = await SecureStore.getItemAsync(storageKey, keyOptions);
  if (!keyHex) return null;
  const cipher = new aesjs.ModeOfOperation.ctr(aesjs.utils.hex.toBytes(keyHex), new aesjs.Counter(1));
  return aesjs.utils.utf8.fromBytes(cipher.decrypt(aesjs.utils.hex.toBytes(value)));
}

export const secureSessionStore = {
  async getItem(key: string): Promise<string | null> {
    const encrypted = await AsyncStorage.getItem(key);
    if (!encrypted) return null;
    try {
      return await decrypt(key, encrypted);
    } catch {
      return null; // key missing or data damaged: treat as signed out
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    // A fresh key for every write, so an old copy of the data can't be read
    // with a key that is still on the phone.
    await AsyncStorage.setItem(key, await encrypt(key, value));
  },
  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
    await SecureStore.deleteItemAsync(key, keyOptions);
  },
};
