import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, ApiError } from '../api/client';
import { useAuth } from '../store/auth';
import { endExcuse, leavingExcused, useLock } from '../store/lock';
import { promptDialog, toast } from '../store/feedback';
import { fonts } from '../theme';
import { biometricProblem, lockKeyOnThisDevice, prepareBiometric, rememberFingerprintAccount, unlockWithBiometric } from '../utils/biometric';
import { firstName } from '../utils/format';
import { setThemeColor, STATUS_BAR_COLOR } from '../utils/install';
import { Text } from './Text';


/**
 * The fingerprint lock: when it is on for this device, the app opens locked and locks again the moment
 * it is left or closed. The fingerprint is checked by the phone and confirmed by the server.
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

  // Fingerprint already on (set up before accounts were remembered): remember the account now
  useEffect(() => {
    if (enabled && user) rememberFingerprintAccount(user);
  }, [enabled, user]);

  // Lock again as soon as the app is left
  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return;
    // Locks the moment the app is left or closed (so even the recent-apps preview shows the lock), except
    // while the phone's own camera is open for a photo or a scan
    const onChange = () => {
      if (document.visibilityState === 'hidden') {
        if (!leavingExcused()) setLocked(true);
      } else endExcuse();
    };
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, [enabled, setLocked]);

  if (!enabled || !locked || !user) return null;
  return <LockScreen name={firstName(user.name)} onUnlocked={() => setLocked(false)} />;
}

/** Lock-screen colours (like WhatsApp's): near-black page, green lock and green "Unlock". */
const LOCK = { bg: '#FFFFFF', icon: '#111111', green: '#1DAA61', text: '#111B21', line: '#D1D7DB', dim: '#667781' };

/**
 * The lock screen, as in WhatsApp: a green lock, "Optimas Locked" and one Unlock button. Tapping Unlock
 * brings up the phone's fingerprint prompt; the app opens by itself as soon as the finger is accepted.
 */
function LockScreen({ onUnlocked }: { name: string; onUnlocked: () => void }) {
  const [busy, setBusy] = useState(false);
  // The password and sign-out ways in show after a fingerprint attempt does not work
  const [other, setOther] = useState(false);
  useEffect(() => {
    void prepareBiometric('unlock');
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
    <LockedView
      busy={busy}
      onUnlock={unlock}
      links={
        other
          ? [
              { label: 'Use password instead', onPress: password },
              { label: 'Sign out', onPress: signOut, dim: true },
            ]
          : []
      }
    />
  );
}

/**
 * The look of the lock (WhatsApp's): a green lock, "Optimas Locked" and one Unlock button, with optional
 * small links underneath. Used by the in-app lock and by the sign-in page when fingerprint is set up.
 */
export function LockedView({ busy, onUnlock, links }: { busy: boolean; onUnlock: () => void; links: { label: string; onPress: () => void; dim?: boolean }[] }) {
  const insets = useSafeAreaInsets();
  // The fingerprint prompt opens by itself: when the lock appears and whenever the app comes back to the
  // front, so a touch on the sensor is all it takes. The button is there if the prompt was closed.
  const unlockRef = useRef(onUnlock);
  unlockRef.current = onUnlock;
  useEffect(() => {
    const t = setTimeout(() => unlockRef.current(), 250);
    // Back from another app: ask again. Not when the fingerprint prompt itself hid the page (cancelling
    // it must not reopen it, or "Use password instead" could never be reached)
    let ownPrompt = false;
    const onShow = () => {
      if (document.visibilityState === 'hidden') ownPrompt = leavingExcused();
      else if (!ownPrompt) unlockRef.current();
    };
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onShow);
    return () => {
      clearTimeout(t);
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onShow);
    };
  }, []);
  useEffect(() => {
    setThemeColor(LOCK.bg);
    return () => setThemeColor(STATUS_BAR_COLOR);
  }, []);
  return (
    <View style={[StyleSheet.absoluteFill, styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]} accessibilityViewIsModal>
      <View style={styles.middle}>
        <Ionicons name="finger-print" size={76} color={LOCK.icon} accessibilityElementsHidden />
        <Text variant="h2" color={LOCK.text} fixedColor align="center" style={styles.title}>
          Optimas Locked
        </Text>
        <Pressable onPress={onUnlock} disabled={busy} accessibilityRole="button" accessibilityLabel="Unlock with fingerprint" style={({ pressed }) => [styles.unlock, pressed && { backgroundColor: 'rgba(37,211,102,0.08)' }]}>
          <Text variant="body" color={LOCK.green} fixedColor style={{ fontFamily: fonts.medium, fontSize: 16 }}>
            Unlock
          </Text>
        </Pressable>
      </View>
      {links.length ? (
        <View style={styles.other}>
          {links.map((l) => (
            <Pressable key={l.label} onPress={l.onPress} hitSlop={8} accessibilityRole="button">
              <Text variant="bodySm" color={l.dim ? LOCK.dim : LOCK.green} fixedColor style={styles.link}>
                {l.label}
              </Text>
            </Pressable>
          ))}
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
