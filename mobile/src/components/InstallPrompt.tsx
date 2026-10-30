import { useEffect, useState } from 'react';
import { Image, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius, space } from '../theme';
import { installSteps, useInstallPrompt } from '../utils/install';
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

/** Round "install" button for top bars — only shown in a browser where installing is possible. */
export function InstallButton({ round, stepsOnly }: { round?: boolean; stepsOnly?: boolean }) {
  const { available, canInstall, install } = useInstallPrompt();
  const [open, setOpen] = useState(false);
  // `stepsOnly`: the page has its own one-tap Install button, so this one only shows where steps are needed
  if (!available || (stepsOnly && canInstall)) return null;
  // One tap installs where the browser allows it; otherwise the steps for this browser
  const tap = async () => {
    if (canInstall) await install();
    else setOpen(true);
  };
  return (
    <>
      {round ? (
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
      )}
      <InstallSheet visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

/** Opens the install sheet (or installs in one tap) from anywhere, e.g. a Profile tile. */
export function useInstallAction() {
  const { available, canInstall, install } = useInstallPrompt();
  const [open, setOpen] = useState(false);
  return {
    available,
    start: async () => {
      if (canInstall) await install();
      else setOpen(true);
    },
    sheet: <InstallSheet visible={open} onClose={() => setOpen(false)} />,
  };
}

/** Full-width pill version for the sign-in page. */
export function InstallPill() {
  const { available } = useInstallPrompt();
  const [open, setOpen] = useState(false);
  if (!available) return null;
  return (
    <>
      <Pressable onPress={() => setOpen(true)} style={({ pressed }) => [styles.pill, pressed && { opacity: 0.85 }]} accessibilityRole="button">
        <Ionicons name="download-outline" size={18} color={colors.onHighlight} />
        <Text variant="title" color={colors.onHighlight} fixedColor>
          Install the Optimas MS app
        </Text>
      </Pressable>
      <InstallSheet visible={open} onClose={() => setOpen(false)} />
    </>
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
  if (!available || !ready || closed || !phone || snoozed()) return null;
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
  const { canInstall, install } = useInstallPrompt();
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

          {!canInstall ? (
            <View style={styles.steps}>
              {installSteps().map((step, i) => (
                <View key={i} style={styles.step}>
                  <Text variant="bodySm" color={colors.highlight} fixedColor style={{ fontFamily: fonts.bold, width: 18 }}>
                    {i + 1}.
                  </Text>
                  <Text variant="bodySm" color={colors.white} fixedColor style={{ flex: 1 }}>
                    {step}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          <View style={styles.actions}>
            <Pressable onPress={onClose} style={[styles.btn, styles.btnGhost]}>
              <Text variant="title" color={colors.white} fixedColor>
                Not now
              </Text>
            </Pressable>
            <Pressable
              onPress={async () => {
                if (canInstall) await install();
                onClose();
              }}
              style={[styles.btn, styles.btnMain]}
            >
              <Text variant="title" color={colors.onHighlight} fixedColor style={{ fontFamily: fonts.bold }}>
                {canInstall ? 'Install' : 'Got it'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
