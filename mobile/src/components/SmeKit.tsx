import { useCallback, useState, type ReactNode } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { fonts, isDark } from '../theme';
import { BAR_SCROLLED_COLOR, STATUS_BAR_COLOR, setThemeColor } from '../utils/install';
import { useAuth } from '../store/auth';
import { Text } from './Text';

/*
 * The Optimas-SME (sme.optimas) page pieces used by Profile and Notifications: its plain page colours,
 * the "Back · Title" bar, the completion ring, labelled sections of rounded rows, its switch, filled
 * tab pills and the red "Log out" pill. Sizes are SME's own (Text scales them for phones as SME does).
 */

type IconName = keyof typeof Ionicons.glyphMap;

/** SME's surface and text colours (its light theme, and its dark theme). */
export const SME = isDark
  ? { page: '#121212', surface: '#1E1E1E', surface3: '#303538', edge2: '#444444', fg: '#FFFFFF', fg2: '#E4E4EA', fg3: '#A8A8B0', fg4: '#82828C', fg5: '#62626C', unread: '#1E1E1E' }
  : { page: '#F8FAFC', surface: '#FFFFFF', surface3: '#EEF2F0', edge2: '#CBD5D0', fg: '#17201C', fg2: '#2B3631', fg3: '#5E6B65', fg4: '#8A9690', fg5: '#AAB6B0', unread: '#F2F2F4' };
/** SME's lime (profile ring, switches) and brand green (tabs). */
export const SME_LIME = '#76B82A';
export const SME_GREEN = isDark ? '#34A94B' : '#2DA043';
export const SME_DANGER = isDark ? '#F87171' : '#DC2626';

/** Where "Back" goes when there is no page to go back to: the person's home. */
export function goHome() {
  const role = useAuth.getState().user?.role;
  const home = role === 'TECHNICIAN' ? '/home' : role === 'CUSTOMER_CARE' ? '/care' : role === 'CUSTOMER' ? '/portal' : '/overview';
  if (router.canGoBack()) router.back();
  else router.replace(home as never);
}

/**
 * Whether the page under the bar is scrolled: at rest the bar and status bar are the page colour (one even
 * surface); scrolled, both turn the band colour. Pass `onScroll` to the page's ScrollView.
 */
export function useScrolledBar() {
  const [scrolled, setScrolled] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setThemeColor(scrolled ? BAR_SCROLLED_COLOR : STATUS_BAR_COLOR);
      return () => setThemeColor(STATUS_BAR_COLOR);
    }, [scrolled]),
  );
  const onScroll = useCallback((e: { nativeEvent: { contentOffset: { y: number } } }) => {
    const now = e.nativeEvent.contentOffset.y > 14;
    setScrolled((was) => (was === now ? was : now));
  }, []);
  return { scrolled, onScroll };
}

/** SME's page bar: "Back" on the left, the title in the middle, an action on the right. Stays put. */
export function SmeAppBar({ title, right, onBack = goHome, scrolled = false }: { title: string; right?: ReactNode; onBack?: () => void; scrolled?: boolean }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingTop: insets.top + 4, backgroundColor: scrolled ? BAR_SCROLLED_COLOR : STATUS_BAR_COLOR }, scrolled && styles.barScrolled]}>
      <View style={styles.barSide}>
        <Pressable onPress={onBack} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back" style={({ pressed }) => [styles.back, pressed && { opacity: 0.6 }]}>
          <Ionicons name="chevron-back" size={18} color={SME.fg2} />
          <Text variant="body" color={SME.fg2} fixedColor style={{ fontFamily: fonts.semibold, fontSize: 14 }}>
            Back
          </Text>
        </Pressable>
      </View>
      <Text variant="title" color={SME.fg} fixedColor numberOfLines={1} style={styles.barTitle}>
        {title}
      </Text>
      <View style={[styles.barSide, { alignItems: 'flex-end' }]}>{right}</View>
    </View>
  );
}

/** Avatar in a ring whose lime arc shows how complete the profile is, with a % pill and a pencil. */
export function ProfileRing({ percent, initial, photo, onEdit, size = 148 }: { percent: number; initial?: string; photo?: string | null; onEdit?: () => void; size?: number }) {
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const filled = (Math.min(100, Math.max(0, percent)) / 100) * c;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} stroke={isDark ? '#FFFFFF' : '#E2E8F0'} />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={SME_LIME}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${c}`}
          transform={`rotate(90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={[styles.avatar, { top: stroke + 4, left: stroke + 4, right: stroke + 4, bottom: stroke + 4 }]}>
        {photo ? (
          <Image source={{ uri: photo }} style={{ width: '100%', height: '100%' }} resizeMode="cover" accessibilityLabel="Profile photo" />
        ) : initial ? (
          <Text variant="display" color={isDark ? '#CBD5E1' : '#94A3B8'} fixedColor style={{ fontFamily: fonts.semibold, fontSize: 48, lineHeight: 56 }}>
            {initial}
          </Text>
        ) : (
          <Ionicons name="person" size={64} color="#CBD5E1" />
        )}
      </View>
      <View style={styles.pct}>
        <Text variant="body" color={SME_LIME} fixedColor style={{ fontFamily: fonts.medium, fontSize: 15 }}>
          {percent}%
        </Text>
      </View>
      {onEdit ? (
        <Pressable onPress={onEdit} accessibilityRole="button" accessibilityLabel="Change profile photo" hitSlop={6} style={({ pressed }) => [styles.pencil, pressed && { transform: [{ scale: 0.9 }] }]}>
          <Ionicons name="pencil" size={18} color={SME_LIME} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** A section heading with its rows underneath. */
export function SmeSection({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <View style={{ gap: 12 }}>
      <View style={styles.sectionHead}>
        <Text variant="title" color={SME.fg} fixedColor style={{ fontFamily: fonts.medium, fontSize: 15, flex: 1 }}>
          {title}
        </Text>
        {right}
      </View>
      <View style={{ gap: 8 }}>{children}</View>
    </View>
  );
}

/** SME's switch: lime when on. */
export function SmeSwitch({ on, busy }: { on: boolean; busy?: boolean }) {
  return (
    <View style={[styles.switch, { backgroundColor: on ? SME_LIME : SME.edge2 }, busy && { opacity: 0.5 }]} accessibilityElementsHidden>
      <View style={[styles.knob, on && { transform: [{ translateX: 24 }] }]} />
    </View>
  );
}

/** A rounded white (dark: charcoal) row: round icon, title and note, and a chevron, count or switch. */
export function SmeRow({
  icon,
  iconColor,
  title,
  sub,
  onPress,
  count,
  toggle,
  busy,
  danger,
}: {
  icon: IconName;
  iconColor?: string;
  title: string;
  sub?: string;
  onPress?: () => void;
  count?: number;
  /** A switch row: whether it is on. */
  toggle?: boolean;
  busy?: boolean;
  danger?: boolean;
}) {
  const isSwitch = toggle !== undefined;
  return (
    <Pressable
      onPress={busy ? undefined : onPress}
      disabled={!onPress}
      accessibilityRole={isSwitch ? 'switch' : 'button'}
      accessibilityState={isSwitch ? { checked: toggle } : undefined}
      accessibilityLabel={title}
      style={({ pressed }) => [styles.row, pressed && { transform: [{ scale: 0.99 }], opacity: 0.9 }]}
    >
      <View style={[styles.rowIcon, danger && { backgroundColor: isDark ? 'rgba(248,113,113,0.12)' : '#FEE2E2' }]}>
        <Ionicons name={icon} size={18} color={danger ? SME_DANGER : (iconColor ?? (isDark ? SME_LIME : SME.fg2))} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="body" color={danger ? SME_DANGER : SME.fg} fixedColor numberOfLines={1} style={{ fontFamily: fonts.medium, fontSize: 14 }}>
          {title}
        </Text>
        {sub ? (
          <Text variant="label" color={SME.fg3} fixedColor numberOfLines={2} style={{ fontSize: 12 }}>
            {sub}
          </Text>
        ) : null}
      </View>
      {count ? (
        <View style={styles.count}>
          <Text variant="label" color="#FFFFFF" fixedColor style={{ fontFamily: fonts.bold, fontSize: 11 }}>
            {count > 99 ? '99+' : count}
          </Text>
        </View>
      ) : null}
      {isSwitch ? <SmeSwitch on={toggle} busy={busy} /> : onPress ? <Ionicons name="chevron-forward" size={16} color={SME.fg5} /> : null}
    </Pressable>
  );
}

/** SME's filled pill tabs: green when chosen, grey otherwise. */
export function SmeChips<T extends string>({ items, value, onChange }: { items: { id: T; label: string }[]; value: T; onChange: (id: T) => void }) {
  return (
    <View style={styles.chips}>
      {items.map((i) => {
        const on = i.id === value;
        return (
          <Pressable
            key={i.id}
            onPress={() => onChange(i.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={({ pressed }) => [styles.chip, { backgroundColor: on ? SME_GREEN : SME.surface3 }, pressed && { transform: [{ scale: 0.97 }] }]}
          >
            <Text variant="bodySm" color={on ? '#FFFFFF' : SME.fg2} fixedColor style={{ fontFamily: fonts.medium, fontSize: 13 }}>
              {i.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** SME's red, full-width "Log out" pill. */
export function SmeLogOut({ onPress, label = 'Log out' }: { onPress: () => void; label?: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.logout, pressed && { transform: [{ scale: 0.99 }], opacity: 0.9 }]}>
      <Ionicons name="log-out-outline" size={17} color="#FFFFFF" />
      <Text variant="body" color="#FFFFFF" fixedColor style={{ fontFamily: fonts.medium, fontSize: 14 }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingHorizontal: 12, paddingBottom: 4, zIndex: 2 },
  barScrolled: { borderBottomWidth: 1, borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(28,29,31,0.06)' },
  barSide: { flex: 1, minWidth: 0 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 2, height: 40, alignSelf: 'flex-start', paddingRight: 6 },
  barTitle: { fontFamily: fonts.medium, fontSize: 17, textAlign: 'center', maxWidth: '52%' },
  avatar: { position: 'absolute', borderRadius: 999, overflow: 'hidden', backgroundColor: isDark ? '#000000' : '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  pct: {
    position: 'absolute',
    bottom: -8,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  pencil: {
    position: 'absolute',
    right: -13,
    top: '50%',
    marginTop: -10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: isDark ? '#2A2A2A' : '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  sectionHead: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 },
  switch: { width: 52, height: 28, borderRadius: 14, padding: 2 },
  knob: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: SME.surface,
    shadowColor: '#0F172A',
    shadowOpacity: isDark ? 0 : 0.05,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: isDark ? 0 : 1,
  },
  rowIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: isDark ? '#1E1E1E' : SME.surface3, alignItems: 'center', justifyContent: 'center', ...(isDark ? { borderWidth: 1, borderColor: '#303538' } : null) },
  count: { minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: 11, backgroundColor: '#E23B41', alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { height: 40, paddingHorizontal: 20, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  logout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: 24, backgroundColor: SME_DANGER },
});
