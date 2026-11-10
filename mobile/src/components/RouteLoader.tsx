import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet } from 'react-native';
import { usePathname } from 'expo-router';
import { usePageLoad } from '../store/pageLoad';
import { BarsLoader } from './Loaders';
import { isDark } from '../theme';

const NATIVE = Platform.OS !== 'web';
/** Only appears when the new page is not ready this quickly (so a fast page never flashes it). */
const SHOW_AFTER_MS = 120;
/** Once the page is on screen with its data, it goes after this long (one frame or two). */
const SETTLE_MS = 40;
/** Never cover the screen longer than this: the page then shows whatever it has (or its own error). */
const MAX_MS = 12_000;
/** A page that never reports itself on screen (one with no data to load) is uncovered after this. */
const UNREPORTED_MS = 900;
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
  // When the page changed — taken while rendering, i.e. BEFORE the new page reports itself on screen
  // (the page's own effects run before this component's), so that report is never missed
  const since = useMemo(() => Date.now(), [path]);
  const busy = usePageLoad((s) => s.pending.size > 0);
  const shownAt = usePageLoad((s) => s.shownAt);
  const ready = !busy && shownAt >= since;

  // A new page: cover it, but only if it is not ready almost at once
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (SKIP.some((s) => path.startsWith(s))) return;
    const t = setTimeout(() => {
      const st = usePageLoad.getState();
      if (st.pending.size === 0 && st.shownAt >= since) return; // already there: no loader at all
      v.setValue(1);
      setVisible(true);
    }, SHOW_AFTER_MS);
    return () => clearTimeout(t);
  }, [path, since, v]);

  // Uncover as soon as the page is on screen with its data
  useEffect(() => {
    if (!visible) return;
    const hide = () => Animated.timing(v, { toValue: 0, duration: 140, easing: Easing.out(Easing.quad), useNativeDriver: NATIVE }).start(() => setVisible(false));
    const giveUp = setTimeout(hide, Math.max(0, since + MAX_MS - Date.now()));
    if (busy) return () => clearTimeout(giveUp);
    const settle = setTimeout(hide, ready ? SETTLE_MS : Math.max(SETTLE_MS, since + UNREPORTED_MS - Date.now()));
    return () => {
      clearTimeout(giveUp);
      clearTimeout(settle);
    };
  }, [visible, busy, ready, since, v]);

  if (!visible) return null;
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.root, { opacity: v }]} accessibilityLabel="Loading">
      <BarsLoader size={48} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { zIndex: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? 'rgba(17,18,20,0.94)' : 'rgba(243,243,243,0.94)' },
});
