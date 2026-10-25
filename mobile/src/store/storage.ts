import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/** Secure key/value storage (Keychain / Keystore); falls back to localStorage on web. */
export const secureStorage = {
  async get(key: string) {
    if (Platform.OS === 'web') return globalThis.localStorage?.getItem(key) ?? null;
    return SecureStore.getItemAsync(key);
  },
  async set(key: string, value: string) {
    if (Platform.OS === 'web') return globalThis.localStorage?.setItem(key, value);
    return SecureStore.setItemAsync(key, value);
  },
  async remove(key: string) {
    if (Platform.OS === 'web') return globalThis.localStorage?.removeItem(key);
    return SecureStore.deleteItemAsync(key);
  },
};
