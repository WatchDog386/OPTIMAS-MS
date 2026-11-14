import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '../theme';
import { useOutbox } from '../offline/outbox';
import { useAuth } from '../store/auth';
import { useNetwork } from '../store/network';
import { Text } from './Text';

const online = () => Platform.OS !== 'web' || typeof navigator === 'undefined' || navigator.onLine !== false;

/**
 * The connection bar, as WhatsApp's "Connecting…": with no signal it says the work is being kept on the
 * phone and how much waits to be sent; while the outbox empties it says "Sending"; anything the server
 * refused shows in amber. Tapping it opens the outbox.
 */
export function OfflineBar() {
  const insets = useSafeAreaInsets();
  const [on, setOn] = useState(online);
  const reachable = useNetwork((s) => s.online);
  const signedIn = useAuth((s) => !!s.user);
  const outbox = useOutbox();
  const path = usePathname();
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

  const waiting = outbox.filter((i) => i.state === 'waiting' || i.state === 'sending').length;
  const failed = outbox.filter((i) => i.state === 'failed').length;
  const offline = !on || !reachable;
  if (path === '/outbox' || path === '/capture' || path === '/scan') return null;

  let look: { bg: string; icon: keyof typeof Ionicons.glyphMap; text: string } | null = null;
  if (offline) {
    look = {
      bg: '#3A3B3D',
      icon: 'cloud-offline-outline',
      text: signedIn ? (waiting ? `Offline · ${waiting} waiting to send` : 'Offline · your work is saved on this phone') : 'No internet connection',
    };
  } else if (failed) look = { bg: '#B45309', icon: 'alert-circle-outline', text: `${failed} could not be sent · tap to see` };
  else if (waiting) look = { bg: '#2DA043', icon: 'cloud-upload-outline', text: `Sending ${waiting}…` };
  if (!look) return null;

  return (
    <Pressable
      onPress={() => signedIn && router.push('/outbox')}
      style={[styles.bar, { paddingTop: insets.top + 6, backgroundColor: look.bg }]}
      accessibilityRole="button"
      accessibilityLabel={`${look.text}. Open the outbox`}
    >
      <Ionicons name={look.icon} size={16} color="#FFFFFF" />
      <Text variant="bodySm" color="#FFFFFF" fixedColor style={{ fontFamily: fonts.semibold }} numberOfLines={1}>
        {look.text}
      </Text>
      {signedIn ? <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.8)" /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 90, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingBottom: 8, paddingHorizontal: 16 },
});
