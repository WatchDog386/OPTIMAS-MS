import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePathname } from 'expo-router';
import { api } from '../api/client';
import { DEMO_TOKEN } from '../api/demoToken';
import type { User } from '../api/types';
import { useAuth } from '../store/auth';
import { useLocation } from '../store/location';
import { toast } from '../store/feedback';
import { colors, fonts, radius, space } from '../theme';
import { askLocation, currentFix, metres, watchFix, type Fix } from '../utils/location';
import { NATIVE, prefersReducedMotion, spring } from '../utils/motion';
import { Button } from './Button';
import { Text } from './Text';

/** Send a position at most this often while standing still… */
const SEND_EVERY_MS = 20_000;
/** …or sooner once the technician has moved this far. */
const SEND_AFTER_M = 40;

const COPY = {
  TECHNICIAN: {
    title: 'Share your location while you work?',
    points: [
      ['navigate-outline', 'Turn-by-turn directions to every job, inside the app'],
      ['flash-outline', 'The office can send you the jobs closest to you'],
      ['person-outline', 'Your customer sees you are on the way'],
    ],
    note: 'Only while the Optimas app is open. You can turn it off any time in Profile.',
  },
  CUSTOMER: {
    title: 'Let Optimas use your location?',
    points: [
      ['home-outline', 'Your technician finds your premises without calling for directions'],
      ['map-outline', 'Follow your technician on the map as they come to you'],
    ],
    note: 'We keep where your premises are, nothing else. You can turn it off any time in Account.',
  },
} as const;

/** Turns location sharing on for this account (asks the browser/phone first). Returns true when on. */
export async function enableLocationSharing(): Promise<boolean> {
  const { user } = useAuth.getState();
  if (!user) return false;
  const allowed = await askLocation();
  if (!allowed) {
    toast.warning('Location is blocked', 'Allow location for this site in your browser or phone settings, then try again.');
    return false;
  }
  await api('/location/consent', { body: { granted: true } });
  await useAuth.getState().updateUser({ ...user, locationConsent: true });
  // Customers: remember where the premises are right away
  if (user.role === 'CUSTOMER') {
    const fix = await currentFix();
    if (fix) await api('/location', { body: { lat: fix.lat, lng: fix.lng, accuracy: fix.accuracy } }).catch(() => undefined);
  }
  return true;
}

export async function disableLocationSharing() {
  const { user } = useAuth.getState();
  if (!user) return;
  await api('/location/consent', { body: { granted: false } });
  await useAuth.getState().updateUser({ ...user, locationConsent: false });
  useLocation.getState().setFix(null);
}

/**
 * Asks technicians and customers (once per sign-in, until they answer) whether the app may use their
 * location, and while a technician has said yes, reports where they are so they can be tracked to jobs.
 */
export function LocationHost() {
  const user = useAuth((s) => s.user);
  const demo = useAuth((s) => s.token === DEMO_TOKEN);
  const dismissed = useLocation((s) => s.promptDismissed);
  const path = usePathname();
  const asks = !!user && !demo && (user.role === 'TECHNICIAN' || user.role === 'CUSTOMER');

  // The saved profile may predate the location question: fetch the current answer once per sign-in
  const checked = useRef<string | null>(null);
  useEffect(() => {
    if (!asks || !user || checked.current === user.id) return;
    checked.current = user.id;
    useLocation.getState().resetPrompt();
    api<{ user: User }>('/auth/me')
      .then(({ user: fresh }) => {
        const current = useAuth.getState().user;
        if (current?.id === fresh.id && current.locationConsent !== fresh.locationConsent) void useAuth.getState().updateUser({ ...current, locationConsent: fresh.locationConsent ?? null });
      })
      .catch(() => undefined);
  }, [asks, user]);

  // Technicians who said yes: follow the phone and report it
  const tracking = !!user && !demo && user.role === 'TECHNICIAN' && user.locationConsent === true;
  useEffect(() => {
    if (!tracking) return;
    let lastSent: Fix | null = null;
    let stopped = false;
    const send = (fix: Fix) => {
      if (lastSent && fix.at - lastSent.at < SEND_EVERY_MS && metres([lastSent.lat, lastSent.lng], [fix.lat, fix.lng]) < SEND_AFTER_M) return;
      lastSent = fix;
      api('/location', { body: { lat: fix.lat, lng: fix.lng, accuracy: fix.accuracy, heading: fix.heading, speed: fix.speed } }).catch((e: { code?: string }) => {
        // Turned off from another device: stop here too
        if (e?.code === 'LOCATION_OFF' && !stopped) {
          const u = useAuth.getState().user;
          if (u) void useAuth.getState().updateUser({ ...u, locationConsent: false });
        }
      });
    };
    const stop = watchFix((fix) => {
      useLocation.getState().setFix(fix);
      send(fix);
    });
    return () => {
      stopped = true;
      stop();
    };
  }, [tracking]);

  const onAuthScreen = path === '/login' || path.startsWith('/change-password');
  const show = asks && !!user && user.locationConsent === null && !dismissed && !user.mustChangePassword && !onAuthScreen;
  return <ConsentSheet visible={show} role={user?.role === 'CUSTOMER' ? 'CUSTOMER' : 'TECHNICIAN'} />;
}

function ConsentSheet({ visible, role }: { visible: boolean; role: 'TECHNICIAN' | 'CUSTOMER' }) {
  const [busy, setBusy] = useState(false);
  const rise = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!visible) return;
    rise.setValue(prefersReducedMotion() ? 1 : 0);
    Animated.spring(rise, { toValue: 1, ...spring.pop, useNativeDriver: NATIVE }).start();
  }, [visible, rise]);
  const copy = COPY[role];

  const allow = async () => {
    setBusy(true);
    try {
      if (await enableLocationSharing()) toast.success('Location is on', role === 'TECHNICIAN' ? 'Directions and live tracking are ready.' : 'Your technician will find you easily.');
      else useLocation.getState().dismissPrompt();
    } catch {
      toast.error('Could not turn location on', 'Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => useLocation.getState().dismissPrompt()}>
      <View style={styles.scrim}>
        <Animated.View style={[styles.sheet, { opacity: rise, transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [60, 0] }) }] }]}>
          <View style={styles.badge}>
            <Ionicons name="location" size={30} color={colors.onHighlight} />
          </View>
          <Text variant="h2" align="center">
            {copy.title}
          </Text>
          <View style={{ gap: 12, alignSelf: 'stretch' }}>
            {copy.points.map(([icon, text]) => (
              <View key={text} style={styles.point}>
                <View style={styles.pointIcon}>
                  <Ionicons name={icon} size={18} color={colors.text} />
                </View>
                <Text variant="bodySm" style={{ flex: 1 }}>
                  {text}
                </Text>
              </View>
            ))}
          </View>
          <Text variant="label" color={colors.textMuted} align="center">
            {copy.note}
          </Text>
          <Button label="Allow location" icon="location-outline" loading={busy} onPress={allow} style={{ alignSelf: 'stretch' }} />
          <Pressable onPress={() => useLocation.getState().dismissPrompt()} hitSlop={8} accessibilityRole="button" style={({ pressed }) => [styles.later, pressed && { opacity: 0.6 }]}>
            <Text variant="title" color={colors.textMuted} style={{ fontFamily: fonts.semibold }}>
              Not now
            </Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(15,18,16,0.45)', justifyContent: 'flex-end', padding: space.md },
  sheet: { backgroundColor: colors.surface, borderRadius: radius.xl + 4, padding: space.xl + 4, gap: space.lg, alignItems: 'center', maxWidth: 520, width: '100%', alignSelf: 'center', marginBottom: space.md },
  badge: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.highlight, alignItems: 'center', justifyContent: 'center' },
  point: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pointIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  later: { paddingVertical: 4 },
});
