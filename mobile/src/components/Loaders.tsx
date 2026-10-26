import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, View } from 'react-native';
import { colors } from '../theme';

const NATIVE = Platform.OS !== 'web';

/** Resting widths of the stacked bars (as a fraction of the loader width) — a compact "stack" mark. */
const BARS = [1, 0.78, 0.92, 0.6];

/**
 * Stacked-bars loader (in the spirit of Paystack's): four rounded bars that stretch and settle one after
 * another in a smooth wave. Calm, branded and readable at any size.
 */
export function BarsLoader({ size = 44, color = colors.charcoal }: { size?: number; color?: string }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(t, { toValue: 1, duration: 1100, easing: Easing.linear, useNativeDriver: NATIVE }));
    loop.start();
    return () => loop.stop();
  }, [t]);
  const barH = Math.max(4, Math.round(size / 7.5));
  const gap = Math.round(barH * 0.7);
  return (
    <View style={{ width: size, gap }} accessibilityRole="progressbar" accessibilityLabel="Loading">
      {BARS.map((w, i) => {
        // Each bar stretches to full width and settles back, 0.15 of a cycle after the bar above it;
        // every bar is at rest again before the loop restarts, so there is no jump
        const p = i * 0.15;
        const scale = t.interpolate({ inputRange: dedupe([0, p, p + 0.2, p + 0.4, 1]), outputRange: dedupe([0, p, p + 0.2, p + 0.4, 1]).map((x) => (x === p + 0.2 ? 1 / w : 1)), easing: Easing.inOut(Easing.quad) });
        return (
          <View key={i} style={{ width: size * w, height: barH, overflow: 'visible' }}>
            <Animated.View
              style={{
                width: size * w,
                height: barH,
                borderRadius: barH / 2,
                backgroundColor: color,
                opacity: i === 0 ? 1 : 0.92 - i * 0.12,
                transform: [{ translateX: Animated.multiply(Animated.subtract(scale, 1), (size * w) / 2) }, { scaleX: scale }],
              }}
            />
          </View>
        );
      })}
    </View>
  );
}

/** Interpolation input ranges must be strictly increasing. */
function dedupe(xs: number[]) {
  return xs.filter((x, i) => i === 0 || x > xs[i - 1]);
}

/** Three dots bouncing in turn, each in a brand colour (splash screen). */
export function DotsLoader({ colors: palette = ['#C3A6FF', '#E6F45A', '#A8E6C4'], size = 12 }: { colors?: string[]; size?: number }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(t, { toValue: 1, duration: 1050, easing: Easing.linear, useNativeDriver: NATIVE }));
    loop.start();
    return () => loop.stop();
  }, [t]);
  return (
    <View style={{ flexDirection: 'row', gap: size * 0.75, height: size * 2.6, alignItems: 'flex-end' }} accessibilityLabel="Loading">
      {palette.map((c, i) => {
        const start = i * 0.18;
        const y = t.interpolate({
          inputRange: [0, start, start + 0.16, start + 0.32, 1],
          outputRange: [0, 0, -size * 1.2, 0, 0],
          easing: Easing.inOut(Easing.quad),
        });
        return <Animated.View key={c} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c, transform: [{ translateY: y }] }} />;
      })}
    </View>
  );
}
