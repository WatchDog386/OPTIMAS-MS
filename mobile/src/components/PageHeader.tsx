import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useApi } from '../hooks/useApi';
import { homeFor, useAuth } from '../store/auth';
import { colors, fonts } from '../theme';
import { OPENED_ON_DESKTOP } from '../theme/desktop';
import { desk } from '../theme/desk';
import { Text } from './Text';

/** Where "back" goes when there is no history (page opened directly or from the tab bar). */
function home() {
  return homeFor(useAuth.getState().user?.role);
}

/**
 * Centred page title with a round back button on the left and one action on the right — the same
 * header the Profile page uses. `right` defaults to the notifications bell.
 */
export function PageHeader({ title, subtitle, right, onBack }: { title: string; subtitle?: string; right?: ReactNode; onBack?: () => void }) {
  const back = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace(home() as never)));
  if (OPENED_ON_DESKTOP) {
    // The dashboard's page head: title and note on the left, actions on the right (the bell is in the top bar)
    return (
      <View style={styles.deskRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="h1" color={desk.strong} fixedColor numberOfLines={1} style={styles.deskTitle}>
            {title}
          </Text>
          {subtitle ? (
            <Text variant="body" color={desk.muted} fixedColor numberOfLines={1} style={{ fontSize: 14 }}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {right === undefined ? null : right}
      </View>
    );
  }
  return (
    <View style={styles.row}>
      <View style={styles.side}>
        <HeaderButton icon="chevron-back" label="Back" onPress={back} />
      </View>
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
      {/* Both sides take the same width, so the title stays centred whatever the action is */}
      <View style={[styles.side, { alignItems: 'flex-end' }]}>{right === undefined ? <BellButton /> : right}</View>
    </View>
  );
}

/** Round glass icon button used on either side of the page header. */
export function HeaderButton({ icon, label, onPress, badge, primary }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; badge?: number; primary?: boolean }) {
  return (
    <Pressable onPress={onPress} hitSlop={10} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [styles.btn, primary && styles.primary, OPENED_ON_DESKTOP && styles.deskBtn, OPENED_ON_DESKTOP && primary && styles.deskPrimary, pressed && { transform: [{ scale: 0.94 }] }]}>
      <Ionicons name={icon} size={OPENED_ON_DESKTOP ? 17 : icon === 'chevron-back' ? 22 : 20} color={OPENED_ON_DESKTOP ? (primary ? '#FFFFFF' : desk.ink) : primary ? colors.onPrimary : colors.text} />
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
  side: { flex: 1, flexBasis: 0, alignItems: 'flex-start' },
  middle: { flexShrink: 1, maxWidth: '64%', alignItems: 'center' },
  // SME page title: 17, medium, a little tight
  title: { textAlign: 'center', fontFamily: fonts.medium, fontSize: 17, letterSpacing: -0.2 },
  btn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.glassStrong, borderWidth: 1, borderColor: colors.glassBorder },
  primary: { backgroundColor: colors.primary, borderColor: colors.primary },
  deskRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 40 },
  deskTitle: { fontFamily: fonts.medium, fontSize: 22, lineHeight: 28, letterSpacing: -0.3 },
  deskBtn: { width: 36, height: 36, borderRadius: 4, backgroundColor: desk.panel, borderColor: desk.border },
  deskPrimary: { backgroundColor: desk.green, borderColor: desk.green },
  badge: { position: 'absolute', top: -3, right: -3, minWidth: 17, height: 17, borderRadius: 9, paddingHorizontal: 3, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.white },
});
