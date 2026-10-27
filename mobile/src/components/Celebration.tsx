import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useFeedback } from '../store/feedback';
import { colors, fonts } from '../theme';
import { NATIVE, haptic, prefersReducedMotion, spring } from '../utils/motion';
import { Text } from './Text';

/*
 * The full-screen "well done" moment: a ring that draws itself, a tick that follows, a burst of confetti and a
 * short message. Shown for a couple of seconds (tap to close). With reduced motion it is the tick alone.
 */

const PIECES = 30;
const PALETTE = [colors.highlight, colors.navy, colors.charcoal, '#FFFFFF', colors.success, colors.highlight];
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);
const R = 46;
const CIRC = 2 * Math.PI * R;
const TICK = 52;

export function CelebrationHost() {
  const c = useFeedback((s) => s.celebration);
  return c ? <Burst key={c.id} title={c.title} message={c.message} /> : null;
}

function Burst({ title, message }: { title: string; message?: string }) {
  const end = useFeedback((s) => s.endCelebration);
  const { width, height } = useWindowDimensions();
  const reduced = prefersReducedMotion();
  const fade = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  const ring = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  const tick = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  const text = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const [drawn, setDrawn] = useState({ ring: reduced ? 1 : 0, tick: reduced ? 1 : 0 });

  const pieces = useMemo(
    () =>
      Array.from({ length: PIECES }, (_, i) => {
        const angle = (-Math.PI * (0.12 + 0.76 * ((i * 0.618) % 1))) + (Math.random() - 0.5) * 0.3; // fan upwards
        return {
          v: new Animated.Value(0),
          angle,
          power: 150 + Math.random() * 170,
          spin: (Math.random() > 0.5 ? 1 : -1) * (180 + Math.random() * 540),
          w: 6 + Math.random() * 6,
          h: 9 + Math.random() * 9,
          round: Math.random() > 0.7,
          color: PALETTE[i % PALETTE.length],
          delay: Math.random() * 90,
          dur: 1500 + Math.random() * 700,
        };
      }),
    [],
  );

  useEffect(() => {
    haptic.success();
    const ids = [
      ring.addListener(({ value }) => setDrawn((d) => ({ ...d, ring: value }))),
      tick.addListener(({ value }) => setDrawn((d) => ({ ...d, tick: value }))),
    ];
    const timeout = setTimeout(close, reduced ? 1800 : 2800);
    Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: NATIVE }).start();
    if (!reduced) {
      Animated.parallel([
        Animated.spring(pop, { toValue: 1, ...spring.pop, useNativeDriver: NATIVE }),
        Animated.timing(ring, { toValue: 1, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
        Animated.timing(tick, { toValue: 1, duration: 340, delay: 470, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      ]).start();
      Animated.timing(text, { toValue: 1, duration: 420, delay: 380, easing: Easing.out(Easing.cubic), useNativeDriver: NATIVE }).start();
      Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1400, easing: Easing.out(Easing.quad), useNativeDriver: NATIVE })).start();
      pieces.forEach((p) => Animated.timing(p.v, { toValue: 1, duration: p.dur, delay: 430 + p.delay, easing: Easing.out(Easing.quad), useNativeDriver: NATIVE }).start());
    }
    return () => {
      clearTimeout(timeout);
      ids.forEach((id, i) => (i === 0 ? ring : tick).removeListener(id));
      pulse.stopAnimation();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function close() {
    Animated.timing(fade, { toValue: 0, duration: 220, useNativeDriver: NATIVE }).start(() => end());
  }

  const cx = width / 2;
  const cy = height * 0.42;
  return (
    <Animated.View style={[styles.backdrop, { opacity: fade }]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close" accessibilityRole="button" />
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {pieces.map((p, i) => {
          const dx = Math.cos(p.angle) * p.power;
          const peak = Math.sin(p.angle) * p.power;
          return (
            <Animated.View
              key={i}
              style={{
                position: 'absolute',
                left: cx - p.w / 2,
                top: cy - p.h / 2,
                width: p.w,
                height: p.h,
                borderRadius: p.round ? p.h : 2,
                backgroundColor: p.color,
                opacity: p.v.interpolate({ inputRange: [0, 0.05, 0.75, 1], outputRange: [0, 1, 1, 0] }),
                transform: [
                  { translateX: p.v.interpolate({ inputRange: [0, 1], outputRange: [0, dx * 1.25] }) },
                  { translateY: p.v.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, peak, peak + 260] }) },
                  { rotate: p.v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.spin}deg`] }) },
                ],
              }}
            />
          );
        })}
      </View>
      <View pointerEvents="none" style={[styles.center, { top: cy - 80 }]}>
        <Animated.View style={{ transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }], opacity: pop.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] }) }}>
          <Animated.View
            style={[styles.pulse, { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] }) }] }]}
          />
          <View style={styles.disc}>
            <Svg width={104} height={104} viewBox="0 0 104 104">
              <AnimatedCircle cx={52} cy={52} r={R} stroke={colors.charcoal} strokeWidth={5} fill="none" strokeLinecap="round" strokeDasharray={`${CIRC} ${CIRC}`} strokeDashoffset={CIRC * (1 - drawn.ring)} transform="rotate(-90 52 52)" />
              <AnimatedPath d="M33 54 L46 67 L72 39" stroke={colors.charcoal} strokeWidth={7} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={`${TICK} ${TICK}`} strokeDashoffset={TICK * (1 - drawn.tick)} />
            </Svg>
          </View>
        </Animated.View>
        <Animated.View style={{ alignItems: 'center', gap: 6, opacity: text, transform: [{ translateY: text.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }}>
          <Text variant="h1" color="#FFFFFF" fixedColor align="center" style={{ fontFamily: fonts.semibold, fontSize: 26 }}>
            {title}
          </Text>
          {message ? (
            <Text variant="body" color="rgba(255,255,255,0.82)" fixedColor align="center" style={{ maxWidth: 300 }}>
              {message}
            </Text>
          ) : null}
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, zIndex: 90, backgroundColor: 'rgba(17,18,19,0.62)' },
  center: { position: 'absolute', left: 0, right: 0, alignItems: 'center', gap: 22 },
  disc: { width: 124, height: 124, borderRadius: 62, backgroundColor: colors.highlight, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 28, shadowOffset: { width: 0, height: 14 } },
  pulse: { position: 'absolute', width: 124, height: 124, borderRadius: 62, backgroundColor: colors.highlight },
});
