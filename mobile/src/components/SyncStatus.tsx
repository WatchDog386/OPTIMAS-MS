import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { dismiss, retryFailed, syncNow, useSyncQueue } from '../offline/queue';
import { useAuth } from '../store/auth';
import { useNetwork } from '../store/network';
import { colors, fonts, radius } from '../theme';
import { time } from '../utils/format';
import { Text } from './Text';

/** A small pill while work saved offline is waiting to be sent; tap it to see what and to retry. */
export function SyncStatus() {
  const items = useSyncQueue();
  const signedIn = useAuth((s) => !!s.token);
  const insets = useSafeAreaInsets();
  const online = useNetwork((s) => s.online);
  const [open, setOpen] = useState(false);
  if (!signedIn) return null;
  // No signal and nothing waiting: just say so, so a blank-looking screen is understood
  if (items.length === 0) {
    return online ? null : (
      <View pointerEvents="none" style={[styles.wrap, { top: insets.top + 6 }]}>
        <View style={[styles.pill, { backgroundColor: colors.surfaceHigh }]}>
          <Ionicons name="cloud-offline-outline" size={16} color={colors.text} />
          <Text variant="label" style={{ fontFamily: fonts.semibold }}>
            No signal · showing saved data
          </Text>
        </View>
      </View>
    );
  }
  const failed = items.filter((i) => i.failed).length;
  const waiting = items.length - failed;

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { top: insets.top + 6 }]}>
      <Pressable onPress={() => setOpen((o) => !o)} style={[styles.pill, failed > 0 && styles.pillBad]} accessibilityRole="button" accessibilityLabel="Work waiting to send">
        <Ionicons name={failed ? 'alert-circle' : 'cloud-upload-outline'} size={16} color={failed ? colors.white : colors.text} />
        <Text variant="label" style={{ fontFamily: fonts.semibold }} color={failed ? colors.white : colors.text}>
          {failed ? `${failed} could not be sent` : `${waiting} waiting to send`}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color={failed ? colors.white : colors.textMuted} />
      </Pressable>
      {open ? (
        <View style={styles.panel}>
          {items.map((i) => (
            <View key={i.id} style={styles.row}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="bodySm" style={{ fontFamily: fonts.semibold }}>
                  {i.label}
                </Text>
                <Text variant="label" color={i.failed ? colors.danger : colors.textMuted}>
                  {i.failed ?? `Taken ${time(i.capturedAt)} · waiting for signal`}
                </Text>
              </View>
              {i.failed ? (
                <Pressable onPress={() => void dismiss(i.id)} hitSlop={8} accessibilityLabel="Dismiss">
                  <Ionicons name="close-circle-outline" size={22} color={colors.textMuted} />
                </Pressable>
              ) : null}
            </View>
          ))}
          <Pressable onPress={() => void (failed ? retryFailed() : syncNow())} style={styles.retry} accessibilityRole="button">
            <Text variant="label" color={colors.onPrimary} style={{ fontFamily: fonts.semibold }}>
              {failed ? 'Try again' : 'Send now'}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 50 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.highlight, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  pillBad: { backgroundColor: colors.danger },
  panel: { marginTop: 8, width: '90%', maxWidth: 420, backgroundColor: colors.surface, borderRadius: radius.lg, padding: 12, gap: 10, shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  retry: { alignSelf: 'flex-end', backgroundColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 8 },
});
