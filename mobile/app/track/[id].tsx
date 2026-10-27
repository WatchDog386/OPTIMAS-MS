import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { JobTrack } from '../../src/api/field';
import { Avatar, HeaderButton, LiveBadge, Loading, MapCanvas, Text, type MapPin } from '../../src/components';
import { useApi } from '../../src/hooks/useApi';
import { useAuth } from '../../src/store/auth';
import { colors, fonts, radius, space } from '../../src/theme';
import { call } from '../../src/utils/contact';
import { clockAt, distanceLabel, minutesLabel } from '../../src/utils/location';
import { NATIVE, prefersReducedMotion, spring } from '../../src/utils/motion';
import { openChatWith } from '../../src/utils/chat';
import { time } from '../../src/utils/format';

const initials = (n: string) => n.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
const ago = (iso: string) => {
  const s = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  return s < 60 ? `${s}s ago` : s < 3600 ? `${Math.round(s / 60)} min ago` : `at ${time(iso)}`;
};

/** Follow a technician to a job on the map: where they are, the road they will take and when they arrive. */
export default function TrackJob() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const role = useAuth((s) => s.user?.role);
  const customer = role === 'CUSTOMER';
  const managers = role === 'ADMIN' || role === 'SUPERVISOR';
  const { data, updatedAt } = useApi<JobTrack>(customer ? `/customer/jobs/${id}/track` : `/tasks/${id}/track`, { poll: 8_000 });
  const [recenter, setRecenter] = useState(0);
  const [panned, setPanned] = useState(false);
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // The card rises in once there is something to show
  const rise = useRef(new Animated.Value(prefersReducedMotion() ? 1 : 0)).current;
  const shown = !!data;
  useEffect(() => {
    if (shown) Animated.spring(rise, { toValue: 1, ...spring.pop, useNativeDriver: NATIVE }).start();
  }, [shown, rise]);

  if (!data) return <Loading />;
  const { job, tech, route, trail } = data;
  const pos = tech.position;
  const pins: MapPin[] = [];
  if (job.lat != null && job.lng != null) pins.push({ id: 'site', kind: 'site', lat: job.lat, lng: job.lng });
  if (pos) pins.push({ id: 'tech', kind: 'tech', lat: pos.lat, lng: pos.lng, label: initials(tech.name), heading: pos.heading, live: pos.kind === 'live' });
  const first = tech.name.split(' ')[0];
  const working = job.status === 'IN_PROGRESS';
  const finished = !['ASSIGNED', 'IN_PROGRESS'].includes(job.status);
  const arrive = route ? Date.parse(route.arriveAt ?? '') || Date.now() + route.duration * 1000 : null;
  const back = () => (router.canGoBack() ? router.back() : router.replace(customer ? '/portal' : `/task/${job.id}`));

  return (
    <View style={styles.root}>
      <MapCanvas
        pins={pins}
        route={working || finished ? null : route?.geometry ?? null}
        trail={trail}
        fitKey={`${job.id}-${!!pos}`}
        recenterKey={recenter}
        padTop={90}
        padBottom={260}
        onUserPan={() => setPanned(true)}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.top, { paddingTop: insets.top + 10 }]} pointerEvents="box-none">
        <HeaderButton icon="chevron-back" label="Back" onPress={back} />
        <View style={styles.chip}>
          <Text variant="title" numberOfLines={1} style={{ fontFamily: fonts.semibold }}>
            {job.code}
          </Text>
          <LiveBadge updatedAt={updatedAt} />
        </View>
      </View>

      <Animated.View style={[styles.bottom, { paddingBottom: insets.bottom + 14, opacity: rise, transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [80, 0] }) }] }]}>
        {panned ? (
          <Pressable onPress={() => (setRecenter((n) => n + 1), setPanned(false))} style={styles.recenter} accessibilityRole="button" accessibilityLabel="Recentre">
            <Ionicons name="scan-outline" size={17} color={colors.text} />
            <Text variant="label" style={{ fontFamily: fonts.semibold }}>
              Show all
            </Text>
          </Pressable>
        ) : null}
        <View style={styles.card}>
          {/* Arrival */}
          {working ? (
            <Headline icon="construct" tint={colors.success} big="On site" small={`${first} started work${job.startedAt ? ` at ${time(job.startedAt)}` : ''}`} />
          ) : finished ? (
            <Headline icon="checkmark-done" tint={colors.success} big="Visit finished" small={job.title} />
          ) : !pos ? (
            <Headline icon="location-outline" tint={colors.textMuted} big="Waiting for location" small={`${first} has not shared a location yet. Call or message them for an update.`} />
          ) : route && arrive ? (
            <View style={styles.etaRow}>
              <Text variant="display" style={styles.eta}>
                {minutesLabel(Math.max(60, (arrive - Date.now()) / 1000))}
              </Text>
              <View style={{ flex: 1 }}>
                <Text variant="title">Arriving about {clockAt(arrive)}</Text>
                <Text variant="bodySm" color={colors.textMuted}>
                  {distanceLabel(route.distance)} away{route.source === 'estimate' ? ' (estimated)' : ''}
                </Text>
              </View>
            </View>
          ) : (
            <Headline icon="navigate" tint={colors.navy} big="On the way" small={job.lat == null ? 'This job has no map pin, so arrival time is unknown.' : 'Working out the arrival time…'} />
          )}

          <View style={styles.person}>
            <Avatar name={tech.name} />
            <View style={{ flex: 1 }}>
              <Text variant="title">{tech.name}</Text>
              <Text variant="label" color={colors.textMuted}>
                {pos ? `${pos.kind === 'live' ? 'Live' : pos.kind === 'photo' ? 'From a photo' : 'Last seen'} · ${ago(pos.at)}` : customer ? 'Your technician' : 'Technician'}
              </Text>
            </View>
            {tech.phone ? <HeaderButton icon="call" label={`Call ${first}`} onPress={() => call(tech.phone)} /> : null}
            {tech.id ? <HeaderButton icon="chatbubble-ellipses" label={`Message ${first}`} onPress={() => openChatWith({ userId: tech.id! })} /> : null}
          </View>

          <View style={styles.dest}>
            <Ionicons name="home-outline" size={16} color={colors.textMuted} />
            <Text variant="bodySm" color={colors.textMuted} numberOfLines={1} style={{ flex: 1 }}>
              {job.customerName} · {job.address}
            </Text>
          </View>
          {managers && job.status === 'ASSIGNED' ? (
            <Pressable onPress={() => router.push(`/admin/forward/${job.id}`)} style={({ pressed }) => [styles.forward, pressed && { opacity: 0.8 }]} accessibilityRole="button">
              <Ionicons name="git-branch-outline" size={18} color={colors.onPrimary} />
              <Text variant="title" color={colors.onPrimary} fixedColor>
                Forward to a nearer technician
              </Text>
            </Pressable>
          ) : null}
        </View>
      </Animated.View>
    </View>
  );
}

function Headline({ icon, tint, big, small }: { icon: keyof typeof Ionicons.glyphMap; tint: string; big: string; small: string }) {
  return (
    <View style={styles.etaRow}>
      <View style={[styles.headIcon, { backgroundColor: `${tint}1A` }]}>
        <Ionicons name={icon} size={22} color={tint} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="h2">{big}</Text>
        <Text variant="bodySm" color={colors.textMuted}>
          {small}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgTop },
  top: { position: 'absolute', left: 0, right: 0, top: 0, paddingHorizontal: space.lg, flexDirection: 'row', alignItems: 'center', gap: 10 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.glassStrong, borderRadius: 20, height: 40, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.glassBorder },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.md, gap: 10 },
  recenter: { alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface, borderRadius: 20, paddingHorizontal: 14, height: 38, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10 },
  card: { backgroundColor: colors.surface, borderRadius: radius.xl + 2, padding: space.lg, gap: 14, shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 20, shadowOffset: { width: 0, height: -2 } },
  etaRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  eta: { fontSize: 32, lineHeight: 38, color: colors.success },
  headIcon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  person: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dest: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  forward: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: 24, backgroundColor: colors.primary },
});
