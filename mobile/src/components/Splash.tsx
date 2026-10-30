import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Platform, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts } from '../theme';
import { DotsLoader } from './Loaders';
import { Text } from './Text';

const LOGO = require('../../assets/logo.png');
const MIN_VISIBLE_MS = 1400;
/** The close, minimise and zoom buttons of a Mac window: red, yellow, green. */
export const MAC_DOTS = ['#FF5F57', '#FEBC2E', '#28C840'];

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
    ]).start(() => onDone());
  }, [ready, minElapsed, opacity, lift, onDone]);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, { opacity }]} accessibilityLabel="Optimas MS is loading">
      <LinearGradient colors={[colors.bgTop, '#E9E9E9', colors.bgBottom]} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />
      <Animated.View style={[styles.center, { transform: [{ translateY: lift }] }]}>
        <Image source={LOGO} style={styles.logo} resizeMode="contain" accessibilityLabel="Optimas Networks" />
        <Text variant="bodySm" color={colors.textMuted}>
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
  dots: { position: 'absolute', bottom: 56 },
});
