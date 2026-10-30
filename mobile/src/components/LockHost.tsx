import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, ApiError } from '../api/client';
import { useAuth } from '../store/auth';
import { useLock } from '../store/lock';
import { promptDialog, toast } from '../store/feedback';
import { fonts } from '../theme';
import { biometricProblem, lockKeyOnThisDevice, prepareBiometric, unlockWithBiometric } from '../utils/biometric';
import { firstName } from '../utils/format';
import { setThemeColor, STATUS_BAR_COLOR } from '../utils/install';
import { Text } from './Text';

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

/** Lock-screen colours (like WhatsApp's): near-black page, green lock and green "Unlock". */
const LOCK = { bg: '#0B141A', green: '#25D366', text: '#E9EDEF', line: '#3B4A54', dim: '#8696A0' };

/**
 * The lock screen, as in WhatsApp: a green lock, "Optimas Locked" and one Unlock button. Tapping Unlock
 * brings up the phone's fingerprint prompt; the app opens by itself as soon as the finger is accepted.
 */
function LockScreen({ onUnlocked }: { name: string; onUnlocked: () => void }) {
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  // The password and sign-out ways in show after a fingerprint attempt does not work
  const [other, setOther] = useState(false);
  useEffect(() => {
    void prepareBiometric('unlock');
    setThemeColor(LOCK.bg);
    return () => setThemeColor(STATUS_BAR_COLOR);
  }, []);

  const unlock = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (await unlockWithBiometric()) onUnlocked();
    } catch (e) {
      setOther(true);
      // Closing the phone's prompt is not worth a pop-up; anything else says why
      const n = (e as { name?: string })?.name;
      if (n !== 'NotAllowedError' && n !== 'AbortError') toast.error('Not unlocked', biometricProblem(e));
      void prepareBiometric('unlock');
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
    <View style={[StyleSheet.absoluteFill, styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]} accessibilityViewIsModal>
      <View style={styles.middle}>
        <Ionicons name="lock-closed" size={72} color={LOCK.green} accessibilityElementsHidden />
        <Text variant="h2" color={LOCK.text} fixedColor align="center" style={styles.title}>
          Optimas Locked
        </Text>
        <Pressable onPress={unlock} disabled={busy} accessibilityRole="button" accessibilityLabel="Unlock with fingerprint" style={({ pressed }) => [styles.unlock, pressed && { backgroundColor: 'rgba(37,211,102,0.08)' }]}>
          <Text variant="body" color={LOCK.green} fixedColor style={{ fontFamily: fonts.medium, fontSize: 16 }}>
            {busy ? 'Waiting for fingerprint…' : 'Unlock'}
          </Text>
        </Pressable>
      </View>
      {other ? (
        <View style={styles.other}>
          <Pressable onPress={password} hitSlop={8} accessibilityRole="button">
            <Text variant="bodySm" color={LOCK.green} fixedColor style={styles.link}>
              Use password instead
            </Text>
          </Pressable>
          <Pressable onPress={signOut} hitSlop={8} accessibilityRole="button">
            <Text variant="bodySm" color={LOCK.dim} fixedColor style={styles.link}>
              Sign out
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // Above the app and its alert banners (60), below toasts (70) and dialogs (80) so the password prompt shows
  root: { zIndex: 65, backgroundColor: LOCK.bg, paddingHorizontal: 28 },
  middle: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 22, paddingTop: 140 },
  title: { fontFamily: fonts.regular, fontSize: 26 },
  unlock: { alignSelf: 'stretch', height: 56, borderRadius: 28, borderWidth: 1.5, borderColor: LOCK.line, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  other: { alignItems: 'center', gap: 14 },
  link: { fontFamily: fonts.semibold, paddingVertical: 4 },
});
