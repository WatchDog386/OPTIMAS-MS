import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '../theme';
import { Text } from './Text';

const online = () => Platform.OS !== 'web' || typeof navigator === 'undefined' || navigator.onLine !== false;

/**
 * The app works online only (the server is the one database), so when the phone loses its connection a
 * bar says so at the top until it is back.
 */
export function OfflineBar() {
  const insets = useSafeAreaInsets();
  const [on, setOn] = useState(online);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const update = () => setOn(online());
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  if (on) return null;
  return (
    <View style={[styles.bar, { paddingTop: insets.top + 6 }]} accessibilityRole="alert" pointerEvents="none">
      <Ionicons name="cloud-offline-outline" size={16} color="#FFFFFF" />
      <Text variant="bodySm" color="#FFFFFF" fixedColor style={{ fontFamily: fonts.semibold }}>
        No internet connection. Connect to keep working.
      </Text>
    </View>
  );
}

/** Older versions kept work on the phone for offline use: remove that store and the old app caches. */
export function clearOfflineLeftovers() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    window.indexedDB?.deleteDatabase('optimas-offline');
  } catch {
    /* nothing to clear */
  }
  if ('caches' in window) void caches.keys().then((keys) => keys.filter((k) => k.startsWith('optimas-shell')).forEach((k) => void caches.delete(k))).catch(() => undefined);
}

const styles = StyleSheet.create({
  bar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 90, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingBottom: 8, paddingHorizontal: 16, backgroundColor: colors.danger },
});
