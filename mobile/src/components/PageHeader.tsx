import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../store/auth';
import { colors, fonts } from '../theme';
import { Text } from './Text';

/** Where "back" goes when there is no history (page opened directly or from the tab bar). */
function home() {
  const role = useAuth.getState().user?.role;
  return role === 'CUSTOMER' ? '/portal' : role === 'TECHNICIAN' ? '/home' : '/overview';
}

/**
 * Centred page title with a round back button on the left and one action on the right — the same
 * header the Profile page uses. `right` defaults to the notifications bell.
 */
export function PageHeader({ title, subtitle, right, onBack }: { title: string; subtitle?: string; right?: ReactNode; onBack?: () => void }) {
  const back = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace(home() as never)));
  return (
    <View style={styles.row}>
      <HeaderButton icon="chevron-back" label="Back" onPress={back} />
      <View style={styles.middle}>
        <Text variant="title" numberOfLines={1} style={styles.title}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="label" color={colors.textMuted} numberOfLines={1} style={{ textAlign: 'center' }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right === undefined ? <BellButton /> : right ?? <View style={styles.btn} />}
    </View>
  );
}

/** Round glass icon button used on either side of the page header. */
export function HeaderButton({ icon, label, onPress, badge, primary }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; badge?: number; primary?: boolean }) {
  return (
    <Pressable onPress={onPress} hitSlop={10} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [styles.btn, primary && styles.primary, pressed && { transform: [{ scale: 0.94 }] }]}>
      <Ionicons name={icon} size={icon === 'chevron-back' ? 22 : 20} color={primary ? colors.onPrimary : colors.text} />
      {badge ? (
        <View style={styles.badge}>
          <Text variant="label" color={colors.white} fixedColor style={{ fontSize: 10, lineHeight: 12, fontFamily: fonts.bold }}>
            {badge > 9 ? '9+' : badge}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/** Notifications bell with the unread count. */
export function BellButton() {
  const unread = useApi<{ unread: number }>('/notifications/unread-count', { poll: 60_000 });
  return <HeaderButton icon="notifications-outline" label="Notifications" badge={unread.data?.unread} onPress={() => router.push('/notifications')} />;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  middle: { flex: 1, alignItems: 'center' },
  title: { textAlign: 'center', fontFamily: fonts.semibold, fontSize: 18 },
  btn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.glassStrong, borderWidth: 1, borderColor: colors.glassBorder },
  primary: { backgroundColor: colors.primary, borderColor: colors.primary },
  badge: { position: 'absolute', top: -3, right: -3, minWidth: 17, height: 17, borderRadius: 9, paddingHorizontal: 3, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.white },
});
