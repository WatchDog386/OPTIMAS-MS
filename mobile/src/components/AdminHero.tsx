import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient as SvgGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { fonts, space } from '../theme';
import { Text } from './Text';

/** Snippet palette: lime-green accents on a dark photographic backdrop. */
export const HERO_GREEN = '#7DC242';
const INK = '#0E100E';

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

/** Dark, full-bleed dashboard hero: greeting header, segmented toggle, action link and stat cards. */
export function AdminHero(p: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.wrap}>
      <LinearGradient colors={['#1B1F1A', '#101210', INK]} style={StyleSheet.absoluteFill} />
      <FibreBackdrop />
      <View style={{ paddingTop: insets.top + 10, paddingHorizontal: space.lg, gap: 16, paddingBottom: 22 }}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={p.onAvatar} accessibilityLabel="My account" style={({ pressed }) => pressed && { transform: [{ scale: 0.94 }] }}>
            <LinearGradient colors={['#A6E35A', '#6DB33A', '#3E7F1E']} start={{ x: 0.2, y: 0.1 }} end={{ x: 0.8, y: 1 }} style={styles.avatar}>
              <View style={styles.gloss} />
              <Ionicons name="person" size={22} color="#FFFFFF" />
            </LinearGradient>
          </Pressable>
          <Text variant="title" color="#FFFFFF" fixedColor align="center" numberOfLines={1} style={styles.hello}>
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
                <Text variant="title" color="#FFFFFF" fixedColor style={{ fontFamily: fonts.bold, fontSize: 15 }}>
                  {t}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Link row */}
        <View style={styles.linkRow}>
          <Pressable onPress={p.link.onPress} style={styles.link} hitSlop={8}>
            <Ionicons name={p.link.icon} size={17} color={HERO_GREEN} />
            <Text variant="title" color={HERO_GREEN} fixedColor style={styles.linkText}>
              {p.link.label}
            </Text>
          </Pressable>
          <Pressable onPress={p.onViewAll} hitSlop={8}>
            <Text variant="label" color="#FFFFFF" fixedColor style={{ fontFamily: fonts.medium }}>
              View All
            </Text>
          </Pressable>
        </View>

        {/* Stat cards */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -space.lg }} contentContainerStyle={{ gap: 10, paddingHorizontal: space.lg }}>
          {p.stats.map((s) => (
            <Pressable key={s.key} onPress={s.onPress} disabled={!s.onPress} style={({ pressed }) => [styles.card, s.alert && styles.cardAlert, pressed && { opacity: 0.85 }]}>
              <View style={[styles.cardIcon, s.alert && { backgroundColor: 'rgba(255,107,91,0.18)' }]}>
                <Ionicons name={s.icon} size={18} color={s.alert ? '#FF8A7A' : HERO_GREEN} />
              </View>
              <Text variant="h1" color="#FFFFFF" fixedColor style={styles.cardValue} numberOfLines={1}>
                {s.value}
              </Text>
              <Text variant="label" color="rgba(255,255,255,0.72)" fixedColor numberOfLines={1}>
                {s.label}
              </Text>
              {s.sub ? (
                <Text variant="label" color={s.alert ? '#FF8A7A' : 'rgba(255,255,255,0.45)'} fixedColor numberOfLines={1} style={{ fontSize: 11 }}>
                  {s.sub}
                </Text>
              ) : null}
            </Pressable>
          ))}
        </ScrollView>
        {p.footer}
      </View>
    </View>
  );
}

function IconBtn({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityLabel={label} hitSlop={6} style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}>
      <Ionicons name={icon} size={22} color="#FFFFFF" />
    </Pressable>
  );
}

/** Glowing fibre-optic strands fanning across the hero, standing in for a photo. */
function FibreBackdrop() {
  const strands = [0, 1, 2, 3, 4, 5, 6].map((i) => `M ${-20 + i * 14} 420 C ${80 + i * 22} ${300 - i * 18}, ${200 + i * 10} ${140 + i * 12}, ${430 + i * 6} ${20 + i * 34}`);
  return (
    <Svg pointerEvents="none" width="100%" height="100%" viewBox="0 0 400 420" preserveAspectRatio="xMidYMid slice" style={StyleSheet.absoluteFill}>
      <Defs>
        <SvgGradient id="fibre" x1="0" y1="1" x2="1" y2="0">
          <Stop offset="0" stopColor={HERO_GREEN} stopOpacity={0} />
          <Stop offset="0.55" stopColor={HERO_GREEN} stopOpacity={0.35} />
          <Stop offset="1" stopColor="#E8F7A0" stopOpacity={0.9} />
        </SvgGradient>
        <RadialGradient id="glow" cx="85%" cy="12%" r="55%">
          <Stop offset="0" stopColor={HERO_GREEN} stopOpacity={0.28} />
          <Stop offset="1" stopColor={HERO_GREEN} stopOpacity={0} />
        </RadialGradient>
        <SvgGradient id="shade" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#000" stopOpacity={0.35} />
          <Stop offset="0.5" stopColor="#000" stopOpacity={0} />
          <Stop offset="1" stopColor="#000" stopOpacity={0.45} />
        </SvgGradient>
      </Defs>
      <Rect x="0" y="0" width="400" height="420" fill="url(#glow)" />
      {strands.map((d, i) => (
        <Path key={`w${i}`} d={d} stroke="url(#fibre)" strokeWidth={6} strokeOpacity={0.12} fill="none" />
      ))}
      {strands.map((d, i) => (
        <Path key={`s${i}`} d={d} stroke="url(#fibre)" strokeWidth={1.4} fill="none" />
      ))}
      <Rect x="0" y="0" width="400" height="420" fill="url(#shade)" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden', borderBottomLeftRadius: 30, borderBottomRightRadius: 30, backgroundColor: INK },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.85)', overflow: 'hidden' },
  gloss: { position: 'absolute', top: 2, left: 6, right: 6, height: '48%', borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.3)' },
  hello: { flex: 1, fontFamily: fonts.semibold, fontSize: 16 },
  icons: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 2, right: 0, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: HERO_GREEN, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 10, lineHeight: 12, fontFamily: fonts.bold },
  toggle: { flexDirection: 'row', backgroundColor: 'rgba(28,32,28,0.88)', borderRadius: 999, padding: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  seg: { flex: 1, height: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  segActive: { backgroundColor: HERO_GREEN, shadowColor: HERO_GREEN, shadowOpacity: 0.45, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  linkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  link: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  linkText: { fontFamily: fonts.bold, fontSize: 14, textDecorationLine: 'underline' },
  card: { width: 150, padding: 14, gap: 4, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  cardAlert: { borderColor: 'rgba(255,138,122,0.45)' },
  cardIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(125,194,66,0.16)', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  cardValue: { fontFamily: fonts.semibold, fontSize: 26, lineHeight: 30 },
});
