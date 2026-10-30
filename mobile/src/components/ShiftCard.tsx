import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { Attendance } from '../api/types';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../store/auth';
import { colors, fonts } from '../theme';
import { time } from '../utils/format';
import { Text } from './Text';

/** Everyone checks in except admins. */
export const checksIn = (role?: string) => !!role && role !== 'ADMIN' && role !== 'CUSTOMER';

/** Today's shift for the signed-in person: where they are and the next step (check in / out). */
export function useShift() {
  const role = useAuth((s) => s.user?.role);
  const today = useApi<{ record: Attendance | null; shiftStart: string }>(checksIn(role) ? '/attendance/today' : null, { poll: 60_000 });
  const record = today.data?.record ?? null;
  const state: 'OFF' | 'ON' | 'DONE' = !record ? 'OFF' : record.checkOutAt ? 'DONE' : 'ON';
  const action = !checksIn(role)
    ? null
    : state === 'OFF'
      ? { label: 'Check in', icon: 'scan-outline' as const, onPress: () => router.push('/check-in?mode=in') }
      : state === 'ON'
        ? { label: 'Check out', icon: 'log-out-outline' as const, onPress: () => router.push('/check-in?mode=out') }
        : null;
  return { show: checksIn(role), state, record, shiftStart: today.data?.shiftStart, action };
}

/** Compact "my shift" card with the check-in / check-out button (office staff, store, customer care). */
export function ShiftCard() {
  const s = useShift();
  if (!s.show) return null;
  const line =
    s.state === 'OFF'
      ? `Not checked in${s.shiftStart ? ` · shift starts ${time(s.shiftStart)}` : ''}`
      : s.state === 'ON'
        ? `On shift since ${time(s.record!.checkInAt)}${s.record!.status === 'LATE' ? ' · late' : ''}`
        : `Shift complete · ${time(s.record!.checkInAt)} – ${time(s.record!.checkOutAt)}`;
  return (
    <View style={styles.card}>
      <View style={[styles.dot, { backgroundColor: s.state === 'ON' ? colors.success : s.state === 'DONE' ? colors.textDim : colors.warning }]} />
      <View style={{ flex: 1 }}>
        <Text variant="title" style={{ fontFamily: fonts.semibold }}>
          My shift
        </Text>
        <Text variant="label" color={colors.textMuted}>
          {line}
        </Text>
      </View>
      {s.action ? (
        <Pressable onPress={s.action.onPress} style={({ pressed }) => [styles.btn, pressed && { opacity: 0.8 }]} accessibilityRole="button">
          <Ionicons name={s.action.icon} size={18} color={colors.onPrimary} />
          <Text variant="bodySm" color={colors.onPrimary} fixedColor style={{ fontFamily: fonts.semibold }}>
            {s.action.label}
          </Text>
        </Pressable>
      ) : (
        <Ionicons name="checkmark-circle" size={26} color={colors.success} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, backgroundColor: colors.glassStrong, borderWidth: 1, borderColor: colors.glassBorder },
  dot: { width: 10, height: 10, borderRadius: 5 },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 42, paddingHorizontal: 16, borderRadius: 21, backgroundColor: colors.primary },
});
