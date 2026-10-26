import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, View, type DimensionValue, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../theme';
import { Text } from './Text';

/*
 * Motion kit for the dashboards: entrance, counting, progress, loading and live-sync cues.
 * Everything is plain Animated (no extra native modules) so it behaves the same on Android, iOS and web.
 */

const NATIVE = Platform.OS !== 'web';
const EASE = Easing.bezier(0.2, 0.8, 0.2, 1);

/** Fades and lifts its children in on mount; `index` staggers siblings so a screen assembles top to bottom. */
export function Reveal({ index = 0, children, style, from = 14 }: { index?: number; children: ReactNode; style?: StyleProp<ViewStyle>; from?: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 520, delay: 60 + index * 70, easing: EASE, useNativeDriver: NATIVE }).start();
  }, [v, index]);
  return (
    <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [from, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}

/** Animates a number from its previous value to the new one; non-numeric values are shown as-is. */
export function CountUp({ value, style, format = (n) => String(Math.round(n)), duration = 900 }: { value: number | string; style?: StyleProp<TextStyle>; format?: (n: number) => string; duration?: number }) {
  const numeric = typeof value === 'number' && Number.isFinite(value);
  const anim = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState(numeric ? format(0) : String(value));
  useEffect(() => {
    if (!numeric) {
      setShown(String(value));
      return;
    }
    const id = anim.addListener(({ value: n }) => setShown(format(n)));
    Animated.timing(anim, { toValue: value as number, duration, easing: EASE, useNativeDriver: false }).start(() => setShown(format(value as number)));
    return () => anim.removeListener(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, numeric]);
  return (
    <Text style={style} numberOfLines={1} adjustsFontSizeToFit>
      {shown}
    </Text>
  );
}

/** Circular progress with an animated sweep; children sit in the middle. */
export function ProgressRing({
  size = 132,
  stroke = 12,
  progress,
  color = colors.highlight,
  track = 'rgba(28,29,31,0.08)',
  children,
}: {
  size?: number;
  stroke?: number;
  progress: number;
  color?: string;
  track?: string;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const anim = useRef(new Animated.Value(0)).current;
  const [p, setP] = useState(0);
  useEffect(() => {
    const id = anim.addListener(({ value }) => setP(value));
    Animated.timing(anim, { toValue: Math.max(0, Math.min(1, progress)), duration: 1100, easing: EASE, useNativeDriver: false }).start();
    return () => anim.removeListener(id);
  }, [progress, anim]);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={c * (1 - p)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children}
    </View>
  );
}

/** A dot with a ring that keeps rippling outwards — "this is live". */
export function PulseDot({ color = colors.success, size = 8 }: { color?: string; size?: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(v, { toValue: 1, duration: 1600, easing: Easing.out(Easing.quad), useNativeDriver: NATIVE }));
    loop.start();
    return () => loop.stop();
  }, [v]);
  return (
    <View style={{ width: size * 2.4, height: size * 2.4, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size,
          backgroundColor: color,
          opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
          transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] }) }],
        }}
      />
      <View style={{ width: size, height: size, borderRadius: size, backgroundColor: color }} />
    </View>
  );
}

const ago = (at: number) => {
  const s = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (s < 10) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  return m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
};

/** "● Live · synced 12s ago" — reassures people the numbers are current. */
export function LiveBadge({ updatedAt, label = 'Live' }: { updatedAt: number | null; label?: string }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 10_000);
    return () => clearInterval(t);
  }, []);
  const stale = updatedAt !== null && Date.now() - updatedAt > 120_000;
  return (
    <View style={styles.live} accessibilityLabel={updatedAt ? `${label}, synced ${ago(updatedAt)}` : 'Syncing'}>
      <PulseDot color={stale ? colors.warning : colors.success} size={6} />
      <Text variant="label" color={colors.textMuted} style={{ fontFamily: fonts.medium, fontSize: 11.5 }}>
        {updatedAt ? `${label} · synced ${ago(updatedAt)}` : 'Syncing…'}
      </Text>
    </View>
  );
}

/** Loading placeholder with a soft light sweep. */
export function Skeleton({ width = '100%', height = 16, radius = 10, style }: { width?: DimensionValue; height?: DimensionValue; radius?: number; style?: StyleProp<ViewStyle> }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(v, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.ease), useNativeDriver: NATIVE }));
    loop.start();
    return () => loop.stop();
  }, [v]);
  return (
    <View style={[{ width, height, borderRadius: radius, overflow: 'hidden', backgroundColor: 'rgba(28,29,31,0.07)' }, style]}>
      <Animated.View style={[StyleSheet.absoluteFill, { width: 160, transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [-160, 420] }) }] }]}>
        <LinearGradient colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.65)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ flex: 1 }} />
      </Animated.View>
    </View>
  );
}

/** Tap-to-rate stars with a little bounce on the chosen star. */
export function StarRating({ value, onChange, size = 30, color = '#F5B400' }: { value: number; onChange?: (n: number) => void; size?: number; color?: string }) {
  const bounce = useRef([0, 1, 2, 3, 4].map(() => new Animated.Value(1))).current;
  const pick = (n: number) => {
    onChange?.(n);
    const b = bounce[n - 1];
    b.setValue(0.6);
    Animated.spring(b, { toValue: 1, friction: 3, tension: 160, useNativeDriver: NATIVE }).start();
  };
  return (
    <View style={{ flexDirection: 'row', gap: 6 }} accessibilityRole="adjustable" accessibilityLabel={`${value} of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable key={n} onPress={onChange ? () => pick(n) : undefined} disabled={!onChange} hitSlop={4} accessibilityLabel={onChange ? `${n} star${n > 1 ? 's' : ''}` : undefined} accessibilityElementsHidden={!onChange}>
          <Animated.View style={{ transform: [{ scale: bounce[n - 1] }] }}>
            <Ionicons name={n <= value ? 'star' : 'star-outline'} size={size} color={n <= value ? color : 'rgba(28,29,31,0.25)'} />
          </Animated.View>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  live: { flexDirection: 'row', alignItems: 'center', gap: 2 },
});
