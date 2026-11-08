import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
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
    if (enabled && !justSwitchedTheme()) setLocked(true);
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

/** The app reloaded a moment ago because Light/Dark mode was switched while unlocked. */
function justSwitchedTheme() {
  try {
    const at = Number(sessionStorage.getItem('optimas.themeReload') ?? 0);
    sessionStorage.removeItem('optimas.themeReload');
    return Date.now() - at < 15_000;
  } catch {
    return false;
  }
}

/** Lock-screen colours (like WhatsApp's): near-black page, green lock and green "Unlock". */
// The app's pop-up look (like "Unlock with password"): a dark card with lime-green buttons, on a dark page
const LOCK = { bg: '#121314', card: '#1E1F21', green: '#7CB82F', text: '#FFFFFF', muted: 'rgba(255,255,255,0.78)' };

/**
 * The lock screen, as in WhatsApp: a green lock, "Optimas Locked" and one Unlock button. Tapping Unlock
 * brings up the phone's fingerprint prompt; the app opens by itself as soon as the finger is accepted.
 */
function LockScreen({ onUnlocked }: { name: string; onUnlocked: () => void }) {
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void prepareBiometric('unlock');
  }, []);

  const unlock = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (await unlockWithBiometric()) onUnlocked();
    } catch (e) {
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

  return (
    <LockedView busy={busy} onUnlock={unlock} onLogin={password} />
  );
}

/**
 * The look of the lock: the app's dark pop-up card ("Optimas Locked", a lock, a green Unlock button),
 * with optional small links underneath. Used by the in-app lock and by the sign-in page when fingerprint is set up.
 */
export function LockedView({ busy, onUnlock, onLogin }: { busy: boolean; onUnlock: () => void; onLogin: () => void }) {
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
    <View style={[StyleSheet.absoluteFill, styles.root, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]} accessibilityViewIsModal>
      <View style={styles.card}>
        <Text variant="h2" color={LOCK.text} fixedColor style={styles.title}>
          Optimas Locked
        </Text>
        <Text style={styles.emoji} accessibilityElementsHidden importantForAccessibility="no">
          🔒
        </Text>
        <Text variant="body" color={LOCK.muted} fixedColor style={styles.message}>
          Touch the fingerprint sensor to unlock.
        </Text>
        {/* Two ways in: Login (password) and the fingerprint */}
        <View style={styles.row}>
          <Pressable onPress={onLogin} accessibilityRole="button" accessibilityLabel="Log in with your password" style={({ pressed }) => [styles.btn, styles.login, pressed && styles.pressed]}>
            <LinearGradient colors={['#7CB82F', '#4E8A1C']} style={StyleSheet.absoluteFill} />
            <Text variant="title" color={LOCK.text} fixedColor style={styles.btnText}>
              Login
            </Text>
          </Pressable>
          <Pressable onPress={onUnlock} disabled={busy} accessibilityRole="button" accessibilityLabel="Unlock with fingerprint" style={({ pressed }) => [styles.btn, styles.finger, busy && { opacity: 0.6 }, pressed && styles.pressed]}>
            <LinearGradient colors={['#7CB82F', '#4E8A1C']} style={StyleSheet.absoluteFill} />
            <Ionicons name="finger-print" size={28} color={LOCK.text} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Above the app and its alert banners (60), below toasts (70) and dialogs (80) so the password prompt shows
  root: { zIndex: 65, backgroundColor: LOCK.bg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  // The pop-up card, as in "Unlock with password"
  card: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingTop: 30,
    paddingBottom: 22,
    borderRadius: 18,
    backgroundColor: LOCK.card,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 16 },
    elevation: 24,
  },
  title: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 30, textAlign: 'center' },
  emoji: { fontSize: 64, lineHeight: 76, textAlign: 'center', marginVertical: 14 },
  message: { textAlign: 'center', marginTop: 4, lineHeight: 24, fontSize: 16 },
  btn: { height: 54, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  login: { flex: 1, overflow: 'hidden' },
  finger: { width: 76, overflow: 'hidden' },
  btnText: { fontFamily: fonts.bold, fontSize: 16 },
  row: { flexDirection: 'row', gap: 12, alignSelf: 'stretch', marginTop: 22 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
