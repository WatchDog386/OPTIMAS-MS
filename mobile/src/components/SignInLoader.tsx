import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/client';
import { apiCache } from '../api/cache';
import type { User } from '../api/types';
import { colors, fonts } from '../theme';
import { firstName } from '../utils/format';
import { GlassBackground } from './Glass';
import { Text } from './Text';

const DURATION = 5000;
const NATIVE = Platform.OS !== 'web';

const PLAN: Record<'TECH' | 'CUSTOMER' | 'STAFF', { steps: string[]; paths: string[] }> = {
  TECH: {
    steps: ['Verifying your account', 'Syncing today’s jobs', 'Loading your devices & stock', 'Preparing your dashboard'],
    paths: ['/attendance/today', '/tasks?status=IN_PROGRESS,ASSIGNED', '/tasks?status=COMPLETED,VERIFIED', '/inventory/my', '/reports/me', '/notifications/unread-count'],
  },
  CUSTOMER: {
    steps: ['Verifying your account', 'Finding your visits', 'Loading your devices', 'Preparing your dashboard'],
    paths: ['/customer/overview', '/notifications/unread-count'],
  },
  STAFF: {
    steps: ['Verifying your account', 'Syncing team attendance', 'Loading jobs & stock', 'Preparing your dashboard'],
    paths: ['/reports/dashboard', '/tasks?status=COMPLETED,VERIFIED', '/notifications/unread-count'],
  },
};

/** Fill the screen cache with the person's dashboard data so it opens instantly. Failures are ignored. */
async function prefetch(paths: string[]) {
  await Promise.all(
    paths.map(async (p) => {
      try {
        apiCache.set(p, { data: await api(p), at: Date.now() });
      } catch {
        // the dashboard will fetch it itself
      }
    }),
  );
}

/**
 * Shown right after a successful sign-in: a calm, branded ~5 s hand-off while the dashboard's data
 * loads in the background. Calls `onDone` when both the animation and the prefetch are finished.
 */
export function SignInLoader({ user, onDone }: { user: User; onDone: () => void }) {
  const plan = user.role === 'TECHNICIAN' ? PLAN.TECH : user.role === 'CUSTOMER' ? PLAN.CUSTOMER : PLAN.STAFF;
  const progress = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const enter = useRef(new Animated.Value(0)).current;
  const [step, setStep] = useState(0);

  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: NATIVE }).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: NATIVE }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: NATIVE }),
      ]),
    );
    loop.start();
    const timers = plan.steps.map((_, i) => setTimeout(() => setStep(i + 1), ((i + 1) * DURATION) / (plan.steps.length + 0.4)));
    const bar = new Promise<void>((resolve) =>
      Animated.timing(progress, { toValue: 1, duration: DURATION, easing: Easing.bezier(0.4, 0, 0.2, 1), useNativeDriver: false }).start(() => resolve()),
    );
    // Never hold the person longer than ~8 s, even on a very slow connection
    const data = Promise.race([prefetch(plan.paths), new Promise((r) => setTimeout(r, 8000))]);
    let cancelled = false;
    void Promise.all([bar, data]).then(() => !cancelled && onDone());
    return () => {
      cancelled = true;
      loop.stop();
      timers.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, { opacity: enter }]} accessibilityLabel="Signing you in">
      <GlassBackground />
      <View style={styles.center}>
        <Animated.View style={[styles.logo, { transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.07] }) }] }]}>
          <Ionicons name="flash" size={38} color={colors.highlight} />
        </Animated.View>
        <Text style={styles.hello}>Welcome back, {firstName(user.name)}</Text>
        <Text variant="bodySm" color={colors.textMuted}>
          Getting everything ready for you
        </Text>

        <View style={styles.steps}>
          {plan.steps.map((label, i) => {
            const done = step > i;
            const active = step === i;
            return (
              <View key={label} style={styles.stepRow}>
                <View style={[styles.stepDot, done && styles.stepDone, active && styles.stepActive]}>
                  {done ? <Ionicons name="checkmark" size={13} color={colors.onHighlight} /> : null}
                </View>
                <Text variant="bodySm" color={done || active ? colors.text : colors.textDim} style={{ fontFamily: active ? fonts.semibold : fonts.medium }}>
                  {label}
                </Text>
              </View>
            );
          })}
        </View>

        <View style={styles.track}>
          <Animated.View style={[styles.fill, { width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { zIndex: 40, alignItems: 'center', justifyContent: 'center' },
  center: { width: '100%', maxWidth: 360, paddingHorizontal: 28, alignItems: 'center', gap: 8 },
  logo: {
    width: 84,
    height: 84,
    borderRadius: 26,
    backgroundColor: colors.charcoal,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    shadowColor: '#1C1D1F',
    shadowOpacity: 0.22,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 14 },
    elevation: 10,
  },
  hello: { fontFamily: fonts.medium, fontSize: 26, lineHeight: 32, letterSpacing: -0.5, color: colors.text, textAlign: 'center' },
  steps: { alignSelf: 'stretch', gap: 14, marginTop: 26, marginBottom: 22 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepDot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: 'rgba(28,29,31,0.15)', alignItems: 'center', justifyContent: 'center' },
  stepDone: { backgroundColor: colors.highlight, borderColor: colors.highlight },
  stepActive: { borderColor: colors.text },
  track: { alignSelf: 'stretch', height: 6, borderRadius: 3, backgroundColor: 'rgba(28,29,31,0.08)', overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, backgroundColor: colors.charcoal },
});
