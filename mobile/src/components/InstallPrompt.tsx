import { useEffect, useState } from 'react';
import { Image, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fonts, radius, space } from '../theme';
import { installNow, isIosSafari, reopenedToInstall, useInstallPrompt } from '../utils/install';
import { toast } from '../store/feedback';
import { GlassCircle } from './Glass';
import { Text } from './Text';

const SNOOZE_KEY = 'optimas.install.dismissedAt';
const SNOOZE_MS = 3 * 24 * 3600_000;
const snoozed = () => {
  try {
    return Date.now() - Number(globalThis.localStorage?.getItem(SNOOZE_KEY) ?? 0) < SNOOZE_MS;
  } catch {
    return false;
  }
};
const snooze = () => {
  try {
    globalThis.localStorage?.setItem(SNOOZE_KEY, String(Date.now()));
  } catch {
    /* private mode */
  }
};

/** Runs the install and says the outcome in one line (no steps to follow). */
async function runInstall() {
  const r = await installNow();
  if (r === 'installed') toast.success('Installing Optimas MS', 'It will appear on your home screen in a moment.');
  else if (r === 'blocked')
    toast.info(
      'Install not offered here',
      /iPhone|iPad|iPod/i.test(navigator.userAgent) ? (isIosSafari() ? 'Apple only allows it from Safari’s Share button → Add to Home Screen.' : 'On iPhone, open this page in Safari to install it.') : /Chrome\//.test(navigator.userAgent) && !/SamsungBrowser|; wv\)/.test(navigator.userAgent) ? 'Chrome has not offered it yet. Reload the page and tap Install again.' : 'This browser does not install apps. Open this page in Chrome.',
    );
}

/** Round "install" button for top bars — only shown in a browser where installing is possible. */
export function InstallButton({ round, stepsOnly }: { round?: boolean; stepsOnly?: boolean }) {
  const { available, canInstall } = useInstallPrompt();
  // `stepsOnly`: the page has its own one-tap Install button
  if (!available || (stepsOnly && canInstall)) return null;
  const tap = () => void runInstall();
  return round ? (
    <GlassCircle onPress={tap} label="Install app" highlight>
      <Ionicons name="download-outline" size={20} color={colors.onHighlight} />
    </GlassCircle>
  ) : (
    <Pressable onPress={tap} style={({ pressed }) => [styles.installChip, pressed && { opacity: 0.85 }]} accessibilityRole="button" accessibilityLabel="Install">
      <Ionicons name="download-outline" size={17} color={colors.onHighlight} />
      <Text variant="bodySm" color={colors.onHighlight} fixedColor style={{ fontFamily: fonts.bold }}>
        Install
      </Text>
    </Pressable>
  );
}

/** Installs the app in one tap from anywhere (a dashboard button, a Profile card, the sign-in page). */
export function useInstallAction() {
  const { available } = useInstallPrompt();
  const [busy, setBusy] = useState(false);
  return {
    /** Shown until the app is installed on this phone. */
    available,
    busy,
    start: async () => {
      if (busy) return;
      setBusy(true);
      try {
        await runInstall();
      } finally {
        setBusy(false);
      }
    },
    /** Kept for pages that still place it; installing needs no sheet now. */
    sheet: null,
  };
}

/** Full-width pill version for the sign-in page. */
export function InstallPill() {
  const { available } = useInstallPrompt();
  if (!available) return null;
  return (
    <Pressable onPress={() => void runInstall()} style={({ pressed }) => [styles.pill, pressed && { opacity: 0.85 }]} accessibilityRole="button">
      <Ionicons name="download-outline" size={18} color={colors.onHighlight} />
      <Text variant="title" color={colors.onHighlight} fixedColor>
        Install the Optimas MS app
      </Text>
    </Pressable>
  );
}

/** Bottom card that appears once on phones (snoozed for 3 days after "Not now"). */
export function InstallPrompt() {
  const { available } = useInstallPrompt();
  const [ready, setReady] = useState(false);
  const [closed, setClosed] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 2500);
    return () => clearTimeout(t);
  }, []);
  const phone = Platform.OS === 'web' && typeof window !== 'undefined' && window.matchMedia?.('(max-width: 1023px)').matches;
  if (!available || closed || ((!ready || !phone || snoozed()) && !reopenedToInstall())) return null;
  return (
    <InstallSheet
      visible
      onClose={() => {
        snooze();
        setClosed(true);
      }}
    />
  );
}

function InstallSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheetWrap} pointerEvents="box-none">
        <View style={styles.sheet} accessibilityRole="alert" accessibilityLabel="Install the Optimas MS app">
          <View style={styles.row}>
            <Image source={{ uri: '/icons/icon-192.png' }} style={styles.icon} />
            <View style={{ flex: 1 }}>
              <Text variant="h2" color={colors.white} fixedColor>
                Install the Optimas MS app
              </Text>
              <Text variant="bodySm" color="rgba(255,255,255,0.75)" fixedColor style={{ marginTop: 4 }}>
                Open it from your home screen — full screen, faster, like any other app.
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <Ionicons name="close" size={22} color="rgba(255,255,255,0.6)" />
            </Pressable>
          </View>

          <View style={styles.actions}>
            <Pressable onPress={onClose} style={[styles.btn, styles.btnGhost]}>
              <Text variant="title" color={colors.white} fixedColor>
                Not now
              </Text>
            </Pressable>
            <Pressable
              onPress={async () => {
                onClose();
                await runInstall();
              }}
              style={[styles.btn, styles.btnMain]}
            >
              <Text variant="title" color={colors.onHighlight} fixedColor style={{ fontFamily: fonts.bold }}>
                Install
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, borderWidth: 1.5, borderColor: colors.brand, backgroundColor: colors.brandSoft },
  profileIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  profileBtn: { height: 34, paddingHorizontal: 16, borderRadius: 17, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  installChip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: colors.highlight },
  pill: { height: 48, borderRadius: radius.pill, backgroundColor: colors.highlight, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.25)' },
  sheetWrap: { flex: 1, justifyContent: 'flex-end', padding: space.md, alignItems: 'center' },
  sheet: { width: '100%', maxWidth: 448, backgroundColor: '#111112', borderRadius: 28, padding: 20, gap: 16 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.lg },
  icon: { width: 56, height: 56, borderRadius: 16 },
  steps: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 18, padding: space.lg, gap: 10 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  actions: { flexDirection: 'row', gap: space.md },
  btn: { flex: 1, height: 50, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  btnGhost: { backgroundColor: 'rgba(255,255,255,0.1)' },
  btnMain: { backgroundColor: colors.highlight },
});

/**
 * The Install card on every Profile page, shown until the app is installed on this phone: one tap where
 * the browser allows it, otherwise the steps for this browser (iPhone: Share → Add to Home Screen).
 */
export function ProfileInstallCard() {
  const installer = useInstallAction();
  if (!installer.available) return null;
  return (
    <>
      <Pressable onPress={() => void installer.start()} style={({ pressed }) => [styles.profileCard, pressed && { opacity: 0.9 }]} accessibilityRole="button" accessibilityLabel="Install the Optimas MS app">
        <View style={styles.profileIcon}>
          <Ionicons name="download-outline" size={22} color="#FFFFFF" />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="title" style={{ fontFamily: fonts.semibold }}>
            Install the app
          </Text>
          <Text variant="bodySm" color={colors.textMuted}>
            Install Optimas MS on this phone
          </Text>
        </View>
        <View style={styles.profileBtn}>
          <Text variant="label" color="#FFFFFF" fixedColor style={{ fontFamily: fonts.semibold, fontSize: 13 }}>
            {installer.busy ? 'Installing…' : 'Install'}
          </Text>
        </View>
      </Pressable>
      {installer.sheet}
    </>
  );
}
