import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Platform, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { DotsLoader } from './Loaders';
import { Text } from './Text';
import { splashDone } from '../utils/install';

const LOGO = require('../../assets/logo-app.webp');
const MIN_VISIBLE_MS = 1400;
/** The close, minimise and zoom buttons of a Mac window: red, yellow, green. */
export const MAC_DOTS = ['#FF5F57', '#FEBC2E', '#28C840'];
/** The opening page is always the dark look, on blue (the same in light and dark mode). */
export const SPLASH_BLUE = ['#16307A', '#122868', '#0C1D4F'] as const;

/**
 * Opening splash. Mirrors the static splash in public/index.html (removed once fonts are in, so there is
 * no flash), stays up for a moment while the session loads, then fades away to reveal the app.
 */
export function Splash({ fontsReady, ready, onDone }: { fontsReady: boolean; ready: boolean; onDone: () => void }) {
  const opacity = useRef(new Animated.Value(1)).current;
  const lift = useRef(new Animated.Value(0)).current;
  const [minElapsed, setMinElapsed] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMinElapsed(true), MIN_VISIBLE_MS);
    return () => clearTimeout(t);
  }, []);

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
    ]).start(() => {
      splashDone();
      onDone();
    });
  }, [ready, minElapsed, opacity, lift, onDone]);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, { opacity }]} accessibilityLabel="Optimas MS is loading">
      <LinearGradient colors={SPLASH_BLUE} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />
      <Animated.View style={[styles.center, { transform: [{ translateY: lift }] }]}>
        <View style={styles.logoPlate}>
          <Image source={LOGO} style={styles.logo} resizeMode="contain" accessibilityLabel="Optimas Networks" />
        </View>
        <Text variant="bodySm" color="rgba(255,255,255,0.78)" fixedColor>
          Field operations, accounted for
        </Text>
      </Animated.View>
      <View style={styles.dots}>
        <DotsLoader colors={MAC_DOTS} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { zIndex: 100, alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', gap: 14 },
  logo: { width: 260, height: 99 },
  // The navy logo sits on a white plate on the blue
  logoPlate: { backgroundColor: '#FFFFFF', borderRadius: 18, paddingHorizontal: 16, paddingVertical: 10 },
  dots: { position: 'absolute', bottom: 56 },
});
