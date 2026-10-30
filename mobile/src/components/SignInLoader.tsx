import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet } from 'react-native';
import { api } from '../api/client';
import { apiCache } from '../api/cache';
import type { User } from '../api/types';
import { GlassBackground } from './Glass';
import { BarsLoader } from './Loaders';

const DURATION = 5000;
const NATIVE = Platform.OS !== 'web';

const PLAN: Record<'TECH' | 'CUSTOMER' | 'STAFF' | 'CARE', { steps: string[]; paths: string[] }> = {
  TECH: {
    steps: ['Verifying your account', 'Syncing today’s jobs', 'Loading your devices & stock', 'Preparing your dashboard'],
    paths: ['/attendance/today', '/tasks?status=IN_PROGRESS,ASSIGNED', '/tasks?status=COMPLETED,VERIFIED', '/inventory/my', '/reports/me', '/notifications/unread-count'],
  },
  CUSTOMER: {
    steps: ['Verifying your account', 'Finding your visits', 'Loading your devices', 'Preparing your dashboard'],
    paths: ['/customer/overview', '/notifications/unread-count'],
  },
  CARE: {
    steps: ['Verifying your account', 'Loading support chats', 'Loading customer requests', 'Preparing your dashboard'],
    paths: ['/chat/conversations', '/requests?status=OPEN', '/tasks?status=ASSIGNED,IN_PROGRESS', '/notifications/unread-count'],
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
 * Shown right after a successful sign-in: the stacked-bars loader for ~5 s while the dashboard's data
 * loads in the background. Calls `onDone` when both the animation and the prefetch are finished.
 */
export function SignInLoader({ user, onDone }: { user: User; onDone: () => void }) {
  const plan = user.role === 'TECHNICIAN' ? PLAN.TECH : user.role === 'CUSTOMER' ? PLAN.CUSTOMER : user.role === 'CUSTOMER_CARE' ? PLAN.CARE : PLAN.STAFF;
  const progress = useRef(new Animated.Value(0)).current;
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: NATIVE }).start();
    const bar = new Promise<void>((resolve) =>
      Animated.timing(progress, { toValue: 1, duration: DURATION, easing: Easing.bezier(0.4, 0, 0.2, 1), useNativeDriver: false }).start(() => resolve()),
    );
    // Never hold the person longer than ~8 s, even on a very slow connection
    const data = Promise.race([prefetch(plan.paths), new Promise((r) => setTimeout(r, 8000))]);
    let cancelled = false;
    void Promise.all([bar, data]).then(() => !cancelled && onDone());
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, { opacity: enter }]} accessibilityLabel="Signing you in">
      <GlassBackground />
      <BarsLoader size={58} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { zIndex: 40, alignItems: 'center', justifyContent: 'center' },
});
