import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, ApiError } from '../api/client';
import { useAuth } from '../store/auth';
import { useLock } from '../store/lock';
import { promptDialog, toast } from '../store/feedback';
import { colors, fonts, space } from '../theme';
import { lockKeyOnThisDevice, unlockWithBiometric } from '../utils/biometric';
import { NATIVE, prefersReducedMotion } from '../utils/motion';
import { firstName } from '../utils/format';
import { Text } from './Text';

const LOGO = require('../../assets/logo.png');
/** Coming back to the app after this long in the background asks for the fingerprint again. */
const RELOCK_AFTER_MS = 60_000;

/**
 * The fingerprint lock: when it is on for this device, the app opens locked and locks again after a
 * minute in the background. The fingerprint is checked by the phone and confirmed by the server.
 */
export function LockHost() {
  const user = useAuth((s) => s.user);
  const locked = useLock((s) => s.locked);
  const setLocked = useLock((s) => s.setLocked);
  useLock((s) => s.rev); // re-read the device setting when it changes
  const enabled = !!user && Platform.OS === 'web' && !!lockKeyOnThisDevice(user.id);

  // Lock when the app opens with a saved sign-in (not right after typing the password)
  const hydrated = useAuth((s) => s.hydrated);
  const checked = useRef(false);
  useEffect(() => {
    if (!hydrated || checked.current) return;
    checked.current = true;
    if (enabled) setLocked(true);
  }, [hydrated, enabled, setLocked]);
  useEffect(() => {
    if (!user) setLocked(false);
  }, [user, setLocked]);

  // Lock again after a while in the background
  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return;
    let hiddenAt = 0;
    const onChange = () => {
      if (document.visibilityState === 'hidden') hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > RELOCK_AFTER_MS) setLocked(true);
    };
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, [enabled, setLocked]);

  if (!enabled || !locked || !user) return null;
  return <LockScreen name={firstName(user.name)} onUnlocked={() => setLocked(false)} />;
}

function LockScreen({ name, onUnlocked }: { name: string; onUnlocked: () => void }) {
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1800, easing: Easing.out(Easing.quad), useNativeDriver: NATIVE }));
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const fingerprint = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (await unlockWithBiometric()) onUnlocked();
    } catch (e) {
      // Closing the phone's prompt is not an error worth shouting about
      const name = (e as { name?: string })?.name;
      if (name !== 'NotAllowedError' && name !== 'AbortError') toast.error('Not unlocked', e instanceof ApiError ? e.message : 'Try again, or use your password.');
    } finally {
      setBusy(false);
    }
  };

  const password = async () => {
    const pw = await promptDialog({ title: 'Unlock with password', message: 'Enter your Optimas password.', emoji: '🔐', confirmLabel: 'Unlock', input: { placeholder: 'Password', required: true, secret: true } });
    if (!pw) return;
    try {
      await api('/auth/verify-password', { body: { password: pw } });
      onUnlocked();
    } catch (e) {
      toast.error('Not unlocked', e instanceof ApiError ? e.message : 'Try again');
    }
  };

  const signOut = async () => {
    await useAuth.getState().logout();
    router.replace('/login');
  };

  return (
    <View style={[StyleSheet.absoluteFill, styles.root, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]} accessibilityViewIsModal>
      <Image source={LOGO} style={styles.logo} resizeMode="contain" accessibilityLabel="Optimas Networks" />
      <View style={{ alignItems: 'center', gap: 6 }}>
        <Text variant="h2" align="center">
          Welcome back, {name}
        </Text>
        <Text variant="bodySm" color={colors.textMuted} align="center">
          Optimas MS is locked
        </Text>
      </View>

      <Pressable onPress={fingerprint} accessibilityRole="button" accessibilityLabel="Unlock with fingerprint" style={({ pressed }) => [styles.touch, pressed && { transform: [{ scale: 0.96 }] }]}>
        <Animated.View style={[styles.wave, { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] }) }] }]} />
        <View style={styles.circle}>
          <Ionicons name="finger-print" size={64} color={busy ? colors.textDim : colors.brand} />
        </View>
      </Pressable>
      <Text variant="title" align="center" style={{ fontFamily: fonts.semibold }}>
        {busy ? 'Checking…' : 'Touch to unlock with your fingerprint'}
      </Text>

      <View style={{ flex: 1 }} />
      <Pressable onPress={password} hitSlop={8} accessibilityRole="button">
        <Text variant="bodySm" color={colors.brand} style={styles.link}>
          Use password instead
        </Text>
      </Pressable>
      <Pressable onPress={signOut} hitSlop={8} accessibilityRole="button">
        <Text variant="bodySm" color={colors.textMuted} style={styles.link}>
          Sign out
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  // Above the app and its alert banners (60), below toasts (70) and dialogs (80) so the password prompt shows
  root: { zIndex: 65, backgroundColor: colors.white, alignItems: 'center', gap: space.xl, paddingHorizontal: 28 },
  logo: { width: 200, height: 76 },
  touch: { width: 150, height: 150, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  wave: { position: 'absolute', width: 130, height: 130, borderRadius: 65, backgroundColor: colors.brand },
  circle: { width: 130, height: 130, borderRadius: 65, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.brand },
  link: { fontFamily: fonts.semibold, paddingVertical: 4 },
});
