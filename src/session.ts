import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const KEY = 'codrive.session';

/** The sign-in token lives in the Keychain or Keystore on phones. SecureStore has no web version. */
export async function loadToken(): Promise<string | null> {
  if (Platform.OS === 'web') return globalThis.localStorage?.getItem(KEY) ?? null;
  return SecureStore.getItemAsync(KEY);
}

export async function saveToken(token: string) {
  if (Platform.OS === 'web') {
    globalThis.localStorage?.setItem(KEY, token);
    return;
  }
  await SecureStore.setItemAsync(KEY, token);
}

export async function clearToken() {
  if (Platform.OS === 'web') {
    globalThis.localStorage?.removeItem(KEY);
    return;
  }
  await SecureStore.deleteItemAsync(KEY);
}
