import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, space } from '../theme';
import { CountUp, LiveBadge, Reveal, Skeleton } from './Motion';
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
  onSearch?: () => void;
  onScan?: () => void;
  /** Extra header icon (e.g. support for customers), shown before the bell. */
  extra?: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    onPress: () => void;
  };
  onBell: () => void;
  tabs?: [string, string];
  tab?: 0 | 1;
  onTab?: (t: 0 | 1) => void;
  link: {
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    onPress: () => void;
  };
  onViewAll?: () => void;
  viewAllLabel?: string;
  stats: HeroStat[];
  /** Hide the colour stat cards (e.g. while a dashboard is being reworked). */
  showStats?: boolean;
  /** First load: show shimmering placeholders instead of zeros. */
  loading?: boolean;
  /** When the figures last synced; shows a live badge under the greeting. */
  updatedAt?: number | null;
  footer?: ReactNode;
}

/** Dashboard hero on the page's glass backdrop: greeting header, segmented toggle, action link and stat cards. */
export function AdminHero(p: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        paddingTop: insets.top + 26,
        paddingHorizontal: space.lg,
        gap: 16,
        paddingBottom: 4,
      }}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={p.onAvatar} accessibilityLabel="My account" style={({ pressed }) => [styles.avatar, pressed && { transform: [{ scale: 0.94 }] }]}>
          <Ionicons name="person" size={22} color={colors.white} />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text variant="title" numberOfLines={1} style={styles.hello}>
            Hello {p.firstName} 👋
          </Text>
          {p.updatedAt !== undefined ? <LiveBadge updatedAt={p.updatedAt} /> : null}
        </View>
        <View style={styles.icons}>
          {p.onSearch ? <IconBtn icon="search" label="Search" onPress={p.onSearch} /> : null}
          {p.onScan ? <IconBtn icon="qr-code-outline" label="Scan a device" onPress={p.onScan} /> : null}
          {p.extra ? <IconBtn icon={p.extra.icon} label={p.extra.label} onPress={p.extra.onPress} /> : null}
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
      {p.tabs ? (
        <View style={styles.toggle}>
          {p.tabs.map((t, i) => {
            const active = p.tab === i;
            return (
              <Pressable key={t} onPress={() => p.onTab?.(i as 0 | 1)} style={[styles.seg, active && styles.segActive]} accessibilityRole="tab" accessibilityState={{ selected: active }}>
                <Text
                  variant="title"
                  color={active ? colors.white : colors.textMuted}
                  fixedColor
                  style={{
                    fontFamily: active ? fonts.bold : fonts.medium,
                    fontSize: 15,
                  }}
                >
                  {t}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {/* Link row */}
      <View style={styles.linkRow}>
        <Pressable onPress={p.link.onPress} style={styles.link} hitSlop={8}>
          <Ionicons name={p.link.icon} size={18} color={LINK_GREEN} />
          <Text variant="title" color={LINK_GREEN} fixedColor style={styles.linkText}>
            {p.link.label}
          </Text>
        </Pressable>
        {p.onViewAll ? (
          <Pressable onPress={p.onViewAll} hitSlop={8}>
            <Text variant="label" color={colors.textMuted} style={{ fontFamily: fonts.medium }}>
              {p.viewAllLabel ?? 'View All'}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {/* Stat cards — colour blocks with a notched corner holding the open arrow */}
      {p.showStats !== false ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -space.lg }} contentContainerStyle={styles.cards}>
          {p.loading
            ? FILLS.map((f) => <Skeleton key={f} width={CARD_W} height={CARD_H} radius={26} />)
            : p.stats.map((s, i) => (
                <Reveal key={s.key} index={i} from={18}>
                  <StatBlock stat={s} fill={FILLS[i % FILLS.length]} />
                </Reveal>
              ))}
        </ScrollView>
      ) : null}
      {p.footer}
    </View>
  );
}

const CARD_W = 158;
const CARD_H = 178;
const FILLS = ['#C3A6FF', '#E6F45A', '#A8E6C4', '#FFD08A'];
const LINK_GREEN = '#2DA043';

/** Rounded rectangle with a concave bite out of the top-right corner (where the arrow button sits). */
function notchedPath(w: number, h: number, r = 26, bite = 46, f = 10) {
  const t = 0.32; // where the fillets meet the bite circle (radians from each edge)
  const p1 = [w - bite * Math.cos(t), bite * Math.sin(t)];
  const p2 = [w - bite * Math.sin(t), bite * Math.cos(t)];
  return [
    `M ${r} 0`,
    `H ${w - bite - f}`,
    `Q ${w - bite} 0 ${p1[0]} ${p1[1]}`,
    `A ${bite} ${bite} 0 0 0 ${p2[0]} ${p2[1]}`,
    `Q ${w} ${bite} ${w} ${bite + f}`,
    `V ${h - r}`,
    `A ${r} ${r} 0 0 1 ${w - r} ${h}`,
    `H ${r}`,
    `A ${r} ${r} 0 0 1 0 ${h - r}`,
    `V ${r}`,
    `A ${r} ${r} 0 0 1 ${r} 0`,
    'Z',
  ].join(' ');
}

/** Long figures (e.g. "100%", "4,500") step down so they never truncate on the fixed-width card. */
const valueSize = (v: string | number) => {
  const n = String(v).length;
  return n <= 3 ? null : n === 4 ? { fontSize: 34, lineHeight: 40 } : { fontSize: 28, lineHeight: 34 };
};

function StatBlock({ stat: s, fill }: { stat: HeroStat; fill: string }) {
  return (
    <Pressable onPress={s.onPress} disabled={!s.onPress} accessibilityLabel={`${s.label}: ${s.value}`} style={({ pressed }) => [styles.block, pressed && { transform: [{ scale: 0.97 }] }]}>
      <Svg width={CARD_W} height={CARD_H} style={StyleSheet.absoluteFill}>
        <Path d={notchedPath(CARD_W, CARD_H)} fill={fill} />
      </Svg>
      <View style={styles.arrow}>
        <Ionicons name="arrow-up-outline" size={17} color={colors.text} style={{ transform: [{ rotate: '45deg' }] }} />
      </View>
      <CountUp value={s.value} style={[styles.blockValue, valueSize(s.value)]} />
      <Text variant="label" color={colors.text} fixedColor numberOfLines={2} style={styles.blockLabel}>
        {s.label}
      </Text>
      <View style={styles.blockFoot}>
        <Text variant="label" color="rgba(28,29,31,0.68)" fixedColor numberOfLines={2} style={styles.blockSub}>
          {s.sub ?? ''}
        </Text>
        <View style={[styles.blockIcon, s.alert && { backgroundColor: colors.danger }]}>
          <Ionicons name={s.icon} size={16} color={colors.white} />
        </View>
      </View>
    </Pressable>
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
  hello: { fontFamily: fonts.semibold, fontSize: 17, textAlign: 'center' },
  icons: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  iconBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 0,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 10, lineHeight: 12, fontFamily: fonts.bold },
  toggle: {
    flexDirection: 'row',
    backgroundColor: colors.glass,
    borderRadius: 999,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  seg: {
    flex: 1,
    height: 44,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segActive: {
    backgroundColor: colors.primary,
    shadowColor: '#1C1D1F',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  link: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  linkText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  cards: {
    gap: 12,
    paddingHorizontal: space.lg,
    paddingTop: 2,
    paddingBottom: 8,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.charcoal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  block: { width: CARD_W, height: CARD_H, padding: 16, paddingTop: 14 },
  arrow: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.glassStrong,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockValue: {
    fontFamily: fonts.semibold,
    fontSize: 40,
    lineHeight: 46,
    letterSpacing: -1,
    marginRight: 34,
    color: colors.text,
  },
  blockLabel: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    lineHeight: 17,
    marginTop: 2,
  },
  blockFoot: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  blockSub: { flex: 1, fontSize: 11, lineHeight: 14 },
  blockIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.charcoal,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
