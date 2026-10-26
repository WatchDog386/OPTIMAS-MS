import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet } from 'react-native';
import { usePathname } from 'expo-router';
import { BarsLoader } from './Loaders';

const NATIVE = Platform.OS !== 'web';
const HOLD_MS = 420;
/** Screens where an overlay would get in the way (live camera / scanner). */
const SKIP = ['/capture', '/scan'];

/** Brief stacked-bars overlay whenever the app moves to another page. */
export function RouteLoader() {
  const path = usePathname();
  const first = useRef(true);
  const v = useRef(new Animated.Value(0)).current;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (SKIP.some((s) => path.startsWith(s))) return;
    setVisible(true);
    v.setValue(1);
    const t = setTimeout(() => {
      Animated.timing(v, { toValue: 0, duration: 240, easing: Easing.out(Easing.quad), useNativeDriver: NATIVE }).start(() => setVisible(false));
    }, HOLD_MS);
    return () => clearTimeout(t);
  }, [path, v]);

  if (!visible) return null;
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.root, { opacity: v }]}>
      <BarsLoader size={48} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { zIndex: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(243,243,243,0.94)' },
});
