import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient as SvgGradient, Path, Stop } from 'react-native-svg';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { BottomTabBarProps, BottomTabNavigationOptions } from 'expo-router/js-tabs';
import { router } from 'expo-router';
import { colors, fonts, isDark } from '../theme';
import { isManager, useAuth } from '../store/auth';
import { Text } from './Text';
import { useDesktop } from '../theme/desktop';

/*
 * Floating tab bar with a smooth dip that follows the active tab, whose icon rides in a raised black
 * bubble — the Knoxville-SME mobile navigation, in its colours: a lime bar, charcoal icons and labels,
 * the active icon white in the black bubble (the same in light and dark mode).
 */
const BAR_TOP = '#CDEE66';
const BAR_BOTTOM = '#B9DD48';
const BUBBLE_FILL = '#1C1F1B';
const INK = '#1C1F1B';
const BAR_HEIGHT = 64;
const RADIUS = 24;
const INSET = 10;
const NOTCH_DEPTH = 38;
const NOTCH_HALF = 42;
const BUBBLE = 46;
const BUBBLE_GAP = 6;
const MUTED = 'rgba(28,31,27,0.72)';

function barPath(w: number, cx: number, depth: number) {
  const h = BAR_HEIGHT;
  const r = RADIUS;
  const left = cx - NOTCH_HALF;
  const right = cx + NOTCH_HALF;
  const rl = Math.max(0, Math.min(r, left));
  const rr = Math.max(0, Math.min(r, w - right));
  const a = NOTCH_HALF * 0.55;
  const b = NOTCH_HALF * 0.62;
  return [
    `M ${rl} 0`,
    `H ${left}`,
    `C ${cx - a} 0 ${cx - b} ${depth} ${cx} ${depth}`,
    `C ${cx + b} ${depth} ${cx + a} 0 ${right} 0`,
    `H ${w - rr}`,
    `A ${rr} ${rr} 0 0 1 ${w} ${rr}`,
    `V ${h - r}`,
    `A ${r} ${r} 0 0 1 ${w - r} ${h}`,
    `H ${r}`,
    `A ${r} ${r} 0 0 1 0 ${h - r}`,
    `V ${rl}`,
    `A ${rl} ${rl} 0 0 1 ${rl} 0`,
    'Z',
  ].join(' ');
}

const tabCenter = (i: number, width: number, count: number) =>
  Math.max(NOTCH_HALF, Math.min(width - NOTCH_HALF, INSET + ((i + 0.5) * (width - INSET * 2)) / count));

type IconFn = (p: { focused: boolean; color: ColorValue; size: number }) => React.ReactNode;

/** On a desktop browser the side rail does the navigating, so the floating bar steps aside. */
export function FloatingTabBar(props: BottomTabBarProps) {
  return useDesktop() ? null : <PhoneTabBar {...props} />;
}

function PhoneTabBar({ state, descriptors, navigateToTab }: BottomTabBarProps) {
  const routes = state.routes.filter((r) => !(descriptors[r.key].options as { hidden?: boolean }).hidden);
  const activeKey = state.routes[state.index]?.key;
  const index = Math.max(0, routes.findIndex((r) => r.key === activeKey));
  const items: TabItem[] = routes.map((route) => {
    const options = descriptors[route.key].options;
    return { key: route.key, label: (options.title ?? route.name) as string, icon: options.tabBarIcon as IconFn | undefined, onPress: () => navigateToTab(route.key) };
  });
  return <TabBarView items={items} index={index} />;
}

type TabItem = { key: string; label: string; icon?: IconFn; onPress: () => void };

/** The bar itself: lime, with the dip and the black bubble under the tab at `index`. */
function TabBarView({ items, index }: { items: TabItem[]; index: number }) {
  const insets = useSafeAreaInsets();
  const [width, setWidth] = useState(0);
  const [cx, setCx] = useState(0);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const id = anim.addListener(({ value }) => setCx(value));
    return () => anim.removeListener(id);
  }, [anim]);

  useEffect(() => {
    if (!width) return;
    const target = tabCenter(index, width, items.length);
    if (cx === 0) {
      anim.setValue(target);
      return;
    }
    Animated.timing(anim, { toValue: target, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, width, items.length]);

  const activeIcon = items[index]?.icon;

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: 18 + insets.bottom }]}>
      <View style={styles.bar} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 && cx > 0 ? (
          <>
            {/* Rounded shadow caster under the body of the bar (below the notch) so no square edges show */}
            <View pointerEvents="none" style={styles.shadowLayer} />
            <Svg width={width} height={BAR_HEIGHT} style={StyleSheet.absoluteFill}>
              <Defs>
                <SvgGradient id="navfill" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={BAR_TOP} />
                  <Stop offset="1" stopColor={BAR_BOTTOM} />
                </SvgGradient>
              </Defs>
              <Path d={barPath(width, cx, NOTCH_DEPTH)} fill="url(#navfill)" />
            </Svg>
            <View style={[styles.bubble, { left: cx - BUBBLE / 2, top: NOTCH_DEPTH - BUBBLE_GAP - BUBBLE }]}>
              {activeIcon ? activeIcon({ focused: true, color: '#FFFFFF', size: 22 }) : null}
            </View>
          </>
        ) : null}

        <View style={[styles.row, { left: INSET, right: INSET }]}>
          {items.map((item, i) => {
            const isActive = i === index;
            return (
              <Pressable key={item.key} onPress={item.onPress} accessibilityRole="tab" accessibilityState={{ selected: isActive }} accessibilityLabel={item.label} style={styles.tab}>
                <View style={{ opacity: isActive ? 0 : 1 }}>{item.icon ? item.icon({ focused: false, color: MUTED, size: 22 }) : null}</View>
                <Text
                  variant="label"
                  color={isActive ? INK : MUTED}
                  fixedColor
                  style={[{ fontSize: 10, lineHeight: 12, fontFamily: isActive ? fonts.semibold : fonts.medium }, isActive && styles.activeLabel]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

/** Each role's tabs, for pages outside the tab screens (e.g. Notifications), as in its tab layout. */
const ROLE_TABS: Record<string, { label: string; href: string; icon: [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]; home?: boolean; managersOnly?: boolean }[]> = {
  STAFF: [
    { label: 'Team', href: '/team', icon: ['people-outline', 'people'], managersOnly: true },
    { label: 'Jobs', href: '/board', icon: ['briefcase-outline', 'briefcase'] },
    { label: 'Overview', href: '/overview', icon: ['grid-outline', 'grid'], home: true },
    { label: 'Store', href: '/store', icon: ['cube-outline', 'cube'] },
    { label: 'Profile', href: '/more', icon: ['person-circle-outline', 'person-circle'] },
  ],
  TECHNICIAN: [
    { label: 'Jobs', href: '/jobs', icon: ['briefcase-outline', 'briefcase'] },
    { label: 'My stock', href: '/stock', icon: ['cube-outline', 'cube'] },
    { label: 'Home', href: '/home', icon: ['flash-outline', 'flash'], home: true },
    { label: 'Chats', href: '/messages', icon: ['chatbubble-ellipses-outline', 'chatbubble-ellipses'] },
    { label: 'Profile', href: '/profile', icon: ['person-outline', 'person'] },
  ],
  CUSTOMER_CARE: [
    { label: 'Chats', href: '/support', icon: ['chatbubble-ellipses-outline', 'chatbubble-ellipses'] },
    { label: 'Requests', href: '/care-requests', icon: ['megaphone-outline', 'megaphone'] },
    { label: 'Home', href: '/care', icon: ['headset-outline', 'headset'], home: true },
    { label: 'Jobs', href: '/care-jobs', icon: ['briefcase-outline', 'briefcase'] },
    { label: 'Profile', href: '/care-profile', icon: ['person-outline', 'person'] },
  ],
  CUSTOMER: [
    { label: 'Requests', href: '/requests', icon: ['chatbubbles-outline', 'chatbubbles'] },
    { label: 'Home', href: '/portal', icon: ['home-outline', 'home'], home: true },
    { label: 'Account', href: '/account', icon: ['person-outline', 'person'] },
  ],
};

/**
 * The footer bar on a page outside the tab screens (Notifications), with the person's own tabs; the
 * home tab stays chosen, as in Knoxville-SME. Hidden on a laptop, where the side rail navigates.
 */
export function RoleTabBar() {
  const desktop = useDesktop();
  const role = useAuth((s) => s.user?.role);
  if (desktop || !role) return null;
  const group = role === 'CUSTOMER' || role === 'CUSTOMER_CARE' ? role : isManager(role) ? 'STAFF' : 'TECHNICIAN';
  const list = ROLE_TABS[group].filter((t) => !(t.managersOnly && role === 'STOREKEEPER'));
  const items: TabItem[] = list.map((t) => ({ key: t.href, label: t.label, icon: tabIcon(t.icon[0], t.icon[1]), onPress: () => router.navigate(t.href as never) }));
  return <TabBarView items={items} index={Math.max(0, list.findIndex((t) => t.home))} />;
}

export const tabScreenOptions: BottomTabNavigationOptions = {
  headerShown: false,
  sceneStyle: { backgroundColor: colors.bg },
};

export const tabIcon =
  (name: keyof typeof Ionicons.glyphMap, active: keyof typeof Ionicons.glyphMap) =>
  ({ color, focused }: { color: ColorValue; focused: boolean }) => <Ionicons name={focused ? active : name} size={22} color={color as string} />;

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  bar: { width: '100%', maxWidth: 448, height: BAR_HEIGHT, backgroundColor: 'transparent' },
  shadowLayer: {
    position: 'absolute',
    left: 2,
    right: 2,
    top: NOTCH_DEPTH,
    bottom: 0,
    borderBottomLeftRadius: RADIUS,
    borderBottomRightRadius: RADIUS,
    backgroundColor: BAR_BOTTOM,
    shadowColor: '#1C1D1F',
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  bubble: {
    position: 'absolute',
    width: BUBBLE,
    height: BUBBLE,
    borderRadius: BUBBLE / 2,
    backgroundColor: BUBBLE_FILL,
    // A thin light ring keeps the black bubble visible on a dark page
    ...(isDark ? { borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' } : null),
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  row: { position: 'absolute', top: 0, bottom: 0, flexDirection: 'row' },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  activeLabel: { position: 'absolute', bottom: 8 },
});
