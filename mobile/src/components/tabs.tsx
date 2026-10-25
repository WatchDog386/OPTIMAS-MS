import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient as SvgGradient, Path, Stop } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps, BottomTabNavigationOptions } from 'expo-router/js-tabs';
import { colors, fonts, shadow } from '../theme';
import { Text } from './Text';

/*
 * Floating lime tab bar with a smooth dip that follows the active tab, whose icon
 * rides in a raised black bubble — the Business-SME mobile navigation.
 */
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

export function FloatingTabBar({ state, descriptors, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const routes = state.routes.filter((r) => !(descriptors[r.key].options as { hidden?: boolean }).hidden);
  const activeKey = state.routes[state.index]?.key;
  const index = Math.max(0, routes.findIndex((r) => r.key === activeKey));
  const [width, setWidth] = useState(0);
  const [cx, setCx] = useState(0);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const id = anim.addListener(({ value }) => setCx(value));
    return () => anim.removeListener(id);
  }, [anim]);

  useEffect(() => {
    if (!width) return;
    const target = tabCenter(index, width, routes.length);
    if (cx === 0) {
      anim.setValue(target);
      return;
    }
    Animated.timing(anim, { toValue: target, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, width, routes.length]);

  const active = routes[index] ? descriptors[routes[index].key].options : undefined;
  const activeIcon = active?.tabBarIcon as IconFn | undefined;

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: 16 + insets.bottom }]}>
      <View style={[styles.bar, shadow.bar]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 && cx > 0 ? (
          <>
            <Svg width={width} height={BAR_HEIGHT} style={StyleSheet.absoluteFill}>
              <Defs>
                <SvgGradient id="navfill" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor="#F2F65A" />
                  <Stop offset="1" stopColor="#E2EA2C" />
                </SvgGradient>
              </Defs>
              <Path d={barPath(width, cx, NOTCH_DEPTH)} fill="url(#navfill)" />
            </Svg>
            <View style={[styles.bubble, { left: cx - BUBBLE / 2, top: NOTCH_DEPTH - BUBBLE_GAP - BUBBLE }]}>
              {activeIcon ? activeIcon({ focused: true, color: colors.white, size: 22 }) : null}
            </View>
          </>
        ) : null}

        <View style={[styles.row, { left: INSET, right: INSET }]}>
          {routes.map((route, i) => {
            const options = descriptors[route.key].options;
            const isActive = i === index;
            const label = (options.title ?? route.name) as string;
            const icon = options.tabBarIcon as IconFn | undefined;
            return (
              <Pressable
                key={route.key}
                onPress={() => navigateToTab(route.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={label}
                style={styles.tab}
              >
                <View style={{ opacity: isActive ? 0 : 1 }}>{icon ? icon({ focused: false, color: MUTED, size: 22 }) : null}</View>
                <Text
                  variant="label"
                  color={isActive ? colors.charcoal : MUTED}
                  style={[{ fontSize: 10, lineHeight: 12, fontFamily: isActive ? fonts.semibold : fonts.medium }, isActive && styles.activeLabel]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
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
  bar: { width: '100%', maxWidth: 448, height: BAR_HEIGHT },
  bubble: {
    position: 'absolute',
    width: BUBBLE,
    height: BUBBLE,
    borderRadius: BUBBLE / 2,
    backgroundColor: colors.charcoal,
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
