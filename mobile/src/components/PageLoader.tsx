import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { usePageLoad } from '../store/pageLoad';
import { GlassBackground } from './Glass';
import { BarsLoader } from './Loaders';

/** Waits this long before showing, so pages that open at once do not flash the loader. */
const SHOW_AFTER_MS = 120;
/** Never hold the screen longer than this: the page shows whatever it has (and its own error). */
const GIVE_UP_MS = 15_000;

/** The loading animation over the screen while a page that has just opened waits for its first data. */
export function PageLoader() {
  const busy = usePageLoad((s) => s.pending.size > 0);
  const [shown, setShown] = useState(false);
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!busy) {
      Animated.timing(fade, { toValue: 0, duration: 160, useNativeDriver: false }).start(() => setShown(false));
      return;
    }
    const show = setTimeout(() => {
      setShown(true);
      fade.setValue(1);
    }, SHOW_AFTER_MS);
    const stop = setTimeout(() => setShown(false), GIVE_UP_MS);
    return () => {
      clearTimeout(show);
      clearTimeout(stop);
    };
  }, [busy, fade]);

  if (!shown) return null;
  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, { opacity: fade }]} accessibilityLabel="Loading" accessibilityLiveRegion="polite">
      <GlassBackground />
      <BarsLoader />
    </Animated.View>
  );
}

const styles = StyleSheet.create({ root: { zIndex: 55, alignItems: 'center', justifyContent: 'center' } });
