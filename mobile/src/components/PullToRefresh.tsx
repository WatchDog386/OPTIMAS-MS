import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, Animated, Platform, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';

const THRESHOLD = 70; // px of (damped) pull needed to trigger
const HOLD = 56; // where the content rests while refreshing
const MIN_SPIN_MS = 700;

/**
 * Pull-to-refresh for the web build. React Native's RefreshControl is a no-op there and the page body
 * never scrolls, so the browser's own gesture can't fire. Pass `scrollRef` to the ScrollView, wrap it in
 * `style`, and render `indicator` above it. Touches are read from the DOM directly (react-native-web's
 * ScrollView doesn't forward touch props). On native this returns inert values (RefreshControl is used).
 */
export function usePullToRefresh(onRefresh: (() => void) | undefined, refreshing: boolean | undefined) {
  const enabled = Platform.OS === 'web' && !!onRefresh;
  const pull = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const start = useRef<number | null>(null);
  const distance = useRef(0);
  const [spinning, setSpinning] = useState(false);
  const [minDone, setMinDone] = useState(true);
  const [armed, setArmed] = useState(false);

  const settle = (to: number) => Animated.spring(pull, { toValue: to, useNativeDriver: false, bounciness: 4 }).start();

  // Finish once the screen's own `refreshing` flag clears and the spinner has shown for a beat.
  useEffect(() => {
    if (spinning && minDone && !refreshing) {
      setSpinning(false);
      settle(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinning, minDone, refreshing]);

  // Keep the latest callbacks for the long-lived DOM listeners.
  const live = useRef({ onRefresh, spinning });
  live.current = { onRefresh, spinning };

  useEffect(() => {
    if (!enabled) return;
    const node = (scrollRef.current as unknown as { getScrollableNode?: () => HTMLElement } | null)?.getScrollableNode?.();
    if (!node) return;
    const onStart = (e: TouchEvent) => {
      start.current = !live.current.spinning && node.scrollTop <= 0 ? e.touches[0].clientY : null;
      distance.current = 0;
    };
    const onMove = (e: TouchEvent) => {
      if (start.current === null) return;
      const dy = e.touches[0].clientY - start.current;
      if (dy <= 0 || node.scrollTop > 0) {
        if (distance.current) pull.setValue(0);
        distance.current = 0;
        return;
      }
      if (e.cancelable) e.preventDefault(); // keep the page still while pulling
      // Rubber-band: the further you pull, the harder it gets
      distance.current = Math.min(130, dy * 0.5);
      pull.setValue(distance.current);
      setArmed(distance.current >= THRESHOLD);
    };
    const onEnd = () => {
      if (start.current === null) return;
      start.current = null;
      if (distance.current >= THRESHOLD) {
        setSpinning(true);
        setMinDone(false);
        setTimeout(() => setMinDone(true), MIN_SPIN_MS);
        settle(HOLD);
        live.current.onRefresh?.();
      } else if (distance.current > 0) settle(0);
      distance.current = 0;
      setArmed(false);
    };
    node.addEventListener('touchstart', onStart, { passive: true });
    node.addEventListener('touchmove', onMove, { passive: false });
    node.addEventListener('touchend', onEnd);
    node.addEventListener('touchcancel', onEnd);
    return () => {
      node.removeEventListener('touchstart', onStart);
      node.removeEventListener('touchmove', onMove);
      node.removeEventListener('touchend', onEnd);
      node.removeEventListener('touchcancel', onEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  if (!enabled) return { enabled, scrollRef, style: undefined, indicator: null };

  const indicator = (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.bubble,
        {
          opacity: pull.interpolate({ inputRange: [0, 24, THRESHOLD], outputRange: [0, 0.6, 1], extrapolate: 'clamp' }),
          transform: [
            { translateY: pull.interpolate({ inputRange: [0, 130], outputRange: [-44, 70], extrapolate: 'clamp' }) },
            { scale: pull.interpolate({ inputRange: [0, THRESHOLD], outputRange: [0.6, 1], extrapolate: 'clamp' }) },
          ],
        },
      ]}
    >
      {spinning ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <Animated.View style={{ transform: [{ rotate: pull.interpolate({ inputRange: [0, THRESHOLD], outputRange: ['0deg', '180deg'], extrapolate: 'clamp' }) }] }}>
          <Ionicons name="arrow-down" size={20} color={armed ? colors.text : colors.textMuted} />
        </Animated.View>
      )}
    </Animated.View>
  );

  return { enabled, scrollRef, style: { flex: 1, transform: [{ translateY: pull }] }, indicator };
}

const styles = StyleSheet.create({
  bubble: {
    position: 'absolute',
    top: 0,
    alignSelf: 'center',
    zIndex: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.glassStrong,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1C1D1F',
    shadowOpacity: 0.14,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
});
