import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet } from 'react-native';
import { usePathname } from 'expo-router';
import { usePageLoad } from '../store/pageLoad';
import { BarsLoader } from './Loaders';

const NATIVE = Platform.OS !== 'web';
/** Shown at least this long, so a quick page change does not flicker. */
const MIN_MS = 300;
/** The new page counts as open once nothing has been loading for this long. */
const SETTLE_MS = 250;
/** Never cover the screen longer than this: the page then shows whatever it has (or its own error). */
const MAX_MS = 15_000;
/** Screens where an overlay would get in the way (live camera / scanner). */
const SKIP = ['/capture', '/scan'];

/**
 * The stacked-bars loader whenever the app moves to another page. It stays until the new page has its
 * data (not for a fixed time, which ended before slow pages had opened), and never longer than 15 s.
 */
export function RouteLoader() {
  const path = usePathname();
  const first = useRef(true);
  const v = useRef(new Animated.Value(0)).current;
  const [visible, setVisible] = useState(false);
  const [since, setSince] = useState(0);
  const busy = usePageLoad((s) => s.pending.size > 0);

  // A new page: cover it
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (SKIP.some((s) => path.startsWith(s))) return;
    setVisible(true);
    setSince(Date.now());
    v.setValue(1);
  }, [path, v]);

  // Uncover once it has been quiet for a moment (and the minimum time has passed)
  useEffect(() => {
    if (!visible) return;
    const hide = () => Animated.timing(v, { toValue: 0, duration: 200, easing: Easing.out(Easing.quad), useNativeDriver: NATIVE }).start(() => setVisible(false));
    const giveUp = setTimeout(hide, Math.max(0, since + MAX_MS - Date.now()));
    if (busy) return () => clearTimeout(giveUp);
    const settle = setTimeout(hide, Math.max(SETTLE_MS, since + MIN_MS - Date.now()));
    return () => {
      clearTimeout(giveUp);
      clearTimeout(settle);
    };
  }, [visible, busy, since, v]);

  if (!visible) return null;
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.root, { opacity: v }]} accessibilityLabel="Loading">
      <BarsLoader size={48} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { zIndex: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(243,243,243,0.94)' },
});
