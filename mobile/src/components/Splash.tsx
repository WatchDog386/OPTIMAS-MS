import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../theme';
import { Text } from './Text';

const MIN_VISIBLE_MS = 1400;

/**
 * Opening splash. Mirrors the static splash in public/index.html (removed once fonts are in, so there is
 * no flash), stays up for a moment while the session loads, then fades away to reveal the app.
 */
export function Splash({ fontsReady, ready, onDone }: { fontsReady: boolean; ready: boolean; onDone: () => void }) {
  const opacity = useRef(new Animated.Value(1)).current;
  const lift = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(0)).current;
  const [minElapsed, setMinElapsed] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMinElapsed(true), MIN_VISIBLE_MS);
    const loop = Animated.loop(Animated.timing(slide, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: Platform.OS !== 'web' }));
    loop.start();
    return () => {
      clearTimeout(t);
      loop.stop();
    };
  }, [slide]);

  useEffect(() => {
    if (!fontsReady || Platform.OS !== 'web' || typeof document === 'undefined') return;
    document.getElementById('boot-splash')?.remove();
  }, [fontsReady]);

  useEffect(() => {
    if (!ready || !minElapsed) return;
    const native = Platform.OS !== 'web';
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: native }),
      Animated.timing(lift, { toValue: -16, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: native }),
    ]).start(() => onDone());
  }, [ready, minElapsed, opacity, lift, onDone]);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, { opacity }]} accessibilityLabel="Optimas MS is loading">
      <LinearGradient colors={[colors.bgTop, '#E9E9E9', colors.bgBottom]} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />
      <Animated.View style={[styles.center, { transform: [{ translateY: lift }] }]}>
        <View style={styles.tile}>
          <Ionicons name="flash" size={44} color={colors.highlight} />
        </View>
        <Text variant="h1" style={styles.name}>
          Optimas MS
        </Text>
        <Text variant="bodySm" color={colors.textMuted}>
          Field operations, accounted for
        </Text>
      </Animated.View>
      <View style={styles.bar}>
        <Animated.View style={[styles.barFill, { transform: [{ translateX: slide.interpolate({ inputRange: [0, 1], outputRange: [-48, 120] }) }] }]} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { zIndex: 100, alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', gap: 14 },
  tile: {
    width: 88,
    height: 88,
    borderRadius: 28,
    backgroundColor: colors.charcoal,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1C1D1F',
    shadowOpacity: 0.22,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 18 },
    elevation: 10,
  },
  name: { fontFamily: fonts.extrabold, fontSize: 28, lineHeight: 34, letterSpacing: -0.5, marginTop: 8 },
  bar: { position: 'absolute', bottom: 64, width: 120, height: 4, borderRadius: 2, backgroundColor: 'rgba(28,29,31,0.1)', overflow: 'hidden' },
  barFill: { width: 48, height: 4, borderRadius: 2, backgroundColor: colors.primary },
});
