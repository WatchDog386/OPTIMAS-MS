import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, space } from '../theme';
import { GlassCircle } from './Glass';
import { Text } from './Text';

export interface HeroStat {
  key: string;
  label: string;
  value: string | number;
  sub?: string;
  icon: keyof typeof Ionicons.glyphMap;
  alert?: boolean;
  onPress?: () => void;
}

interface Props {
  firstName: string;
  unread?: number;
  onAvatar: () => void;
  onSearch: () => void;
  onScan: () => void;
  onBell: () => void;
  tabs: [string, string];
  tab: 0 | 1;
  onTab: (t: 0 | 1) => void;
  link: { label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void };
  onViewAll: () => void;
  stats: HeroStat[];
  footer?: ReactNode;
}

/** Dashboard hero on the page's glass backdrop: greeting header, segmented toggle, action link and stat cards. */
export function AdminHero(p: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: insets.top + 10, paddingHorizontal: space.lg, gap: 16, paddingBottom: 4 }}>
      {/* Header */}
      <View style={styles.header}>
        <GlassCircle size={48} onPress={p.onAvatar} label="My account">
          <Ionicons name="person-outline" size={22} color={colors.text} />
        </GlassCircle>
        <Text variant="title" numberOfLines={1} style={styles.hello}>
          Hello {p.firstName} 👋
        </Text>
        <View style={styles.icons}>
          <IconBtn icon="search" label="Search" onPress={p.onSearch} />
          <IconBtn icon="qr-code-outline" label="Scan a device" onPress={p.onScan} />
          <View>
            <IconBtn icon="notifications-outline" label="Notifications" onPress={p.onBell} />
            {p.unread ? (
              <View style={styles.badge} pointerEvents="none">
                <Text variant="label" color="#FFFFFF" fixedColor style={styles.badgeText}>
                  {p.unread > 99 ? '99+' : p.unread}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      {/* Segmented toggle */}
      <View style={styles.toggle}>
        {p.tabs.map((t, i) => {
          const active = p.tab === i;
          return (
            <Pressable key={t} onPress={() => p.onTab(i as 0 | 1)} style={[styles.seg, active && styles.segActive]} accessibilityRole="tab" accessibilityState={{ selected: active }}>
              <Text variant="title" color={active ? colors.white : colors.textMuted} fixedColor style={{ fontFamily: active ? fonts.bold : fonts.medium, fontSize: 15 }}>
                {t}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Link row */}
      <View style={styles.linkRow}>
        <Pressable onPress={p.link.onPress} style={styles.link} hitSlop={8}>
          <Ionicons name={p.link.icon} size={18} color={colors.text} />
          <Text variant="title" style={styles.linkText}>
            {p.link.label}
          </Text>
        </Pressable>
        <Pressable onPress={p.onViewAll} hitSlop={8}>
          <Text variant="label" color={colors.textMuted} style={{ fontFamily: fonts.medium }}>
            View All
          </Text>
        </Pressable>
      </View>

      {/* Stat cards — same frosted surface as the cards further down the page */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -space.lg }} contentContainerStyle={styles.cards}>
        {p.stats.map((s) => (
          <Pressable key={s.key} onPress={s.onPress} disabled={!s.onPress} style={({ pressed }) => [styles.card, s.alert && styles.cardAlert, pressed && { transform: [{ scale: 0.97 }] }]}>
            <View style={[styles.cardIcon, s.alert && { backgroundColor: colors.dangerSoft }]}>
              <Ionicons name={s.icon} size={18} color={s.alert ? colors.danger : colors.onHighlight} />
            </View>
            <Text variant="h1" style={styles.cardValue} numberOfLines={1}>
              {s.value}
            </Text>
            <Text variant="label" color={colors.text} numberOfLines={1} style={{ fontFamily: fonts.medium }}>
              {s.label}
            </Text>
            {s.sub ? (
              <Text variant="label" color={s.alert ? colors.danger : colors.textMuted} numberOfLines={1} style={{ fontSize: 11 }}>
                {s.sub}
              </Text>
            ) : null}
          </Pressable>
        ))}
      </ScrollView>
      {p.footer}
    </View>
  );
}

function IconBtn({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityLabel={label} hitSlop={6} style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}>
      <Ionicons name={icon} size={22} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  hello: { flex: 1, fontFamily: fonts.semibold, fontSize: 17, textAlign: 'center' },
  icons: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  iconBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 2, right: 0, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 10, lineHeight: 12, fontFamily: fonts.bold },
  toggle: { flexDirection: 'row', backgroundColor: colors.glass, borderRadius: 999, padding: 4, borderWidth: 1, borderColor: colors.glassBorder },
  seg: { flex: 1, height: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  segActive: { backgroundColor: colors.primary, shadowColor: '#1C1D1F', shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  linkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 2 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  linkText: { fontFamily: fonts.bold, fontSize: 14, textDecorationLine: 'underline' },
  // Vertical padding leaves room for the card shadows inside the horizontal scroller
  cards: { gap: 10, paddingHorizontal: space.lg, paddingTop: 2, paddingBottom: 14 },
  card: {
    width: 150,
    padding: 16,
    gap: 4,
    borderRadius: 24,
    backgroundColor: colors.glassStrong,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    shadowColor: '#1C1D1F',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  cardAlert: { borderColor: 'rgba(220,38,38,0.35)' },
  cardIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.highlight, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  cardValue: { fontFamily: fonts.semibold, fontSize: 28, lineHeight: 32 },
});
