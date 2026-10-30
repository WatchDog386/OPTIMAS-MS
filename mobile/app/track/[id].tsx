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
          <View style={styles.handle} />
          {/* Arrival, with the technician on the right (ride-hailing style) */}
          <View style={styles.sheetTop}>
            <View style={{ flex: 1 }}>
              {working ? (
                <>
                  <Text variant="bodySm" color={colors.textMuted}>
                    On site
                  </Text>
                  <Text variant="display" style={styles.big}>
                    Working
                  </Text>
                  <Text variant="label" color={colors.textMuted}>
                    Started {job.startedAt ? time(job.startedAt) : 'just now'}
                  </Text>
                </>
              ) : finished ? (
                <>
                  <Text variant="bodySm" color={colors.textMuted}>
                    Visit
                  </Text>
                  <Text variant="display" style={styles.big}>
                    Finished
                  </Text>
                </>
              ) : !pos ? (
                <>
                  <Text variant="bodySm" color={colors.textMuted}>
                    Arriving in
                  </Text>
                  <Text variant="display" style={[styles.big, { fontSize: 26 }]}>
                    Waiting for location
                  </Text>
                  <Text variant="label" color={colors.textMuted}>
                    {first} has not shared a location yet
                  </Text>
                </>
              ) : route && arrive ? (
                <>
                  <Text variant="bodySm" color={colors.textMuted}>
                    Arriving in
                  </Text>
                  <Text variant="display" style={styles.big}>
                    {minutesLabel(Math.max(60, (arrive - Date.now()) / 1000))}
                  </Text>
                </>
              ) : (
                <>
                  <Text variant="bodySm" color={colors.textMuted}>
                    On the way
                  </Text>
                  <Text variant="display" style={[styles.big, { fontSize: 26 }]}>
                    {job.lat == null ? 'Time unknown' : 'Working it out…'}
                  </Text>
                </>
              )}
            </View>
            <View style={styles.avatarRing}>
              <Avatar name={tech.name} size={58} />
              {pos?.kind === 'live' ? <View style={styles.liveBadge} /> : null}
            </View>
          </View>

          <View style={{ gap: 2 }}>
            <Text variant="title" numberOfLines={1} style={{ fontFamily: fonts.semibold }}>
              {job.code} · {job.title}
            </Text>
            <Text variant="bodySm" color={colors.textMuted} numberOfLines={1}>
              {tech.name} · {pos ? `${pos.kind === 'live' ? 'live' : pos.kind === 'photo' ? 'from a photo' : 'last seen'} ${ago(pos.at)}` : customer ? 'your technician' : 'technician'}
            </Text>
          </View>

          {/* Message box and call button */}
          <View style={styles.contactRow}>
            {tech.id ? (
              <Pressable onPress={() => openChatWith({ userId: tech.id! })} style={({ pressed }) => [styles.notes, pressed && { opacity: 0.75 }]} accessibilityRole="button" accessibilityLabel={`Message ${first}`}>
                <Ionicons name="chatbubble-ellipses" size={20} color={colors.text} />
                <Text variant="body" color={colors.textMuted}>
                  Message {first}…
                </Text>
              </Pressable>
            ) : (
              <View style={{ flex: 1 }} />
            )}
            {tech.phone ? (
              <Pressable onPress={() => call(tech.phone)} style={({ pressed }) => [styles.callBtn, pressed && { opacity: 0.75 }]} accessibilityRole="button" accessibilityLabel={`Call ${first}`}>
                <Ionicons name="call" size={20} color={colors.text} />
              </Pressable>
            ) : null}
          </View>

          <View style={styles.route}>
            <Text variant="h2" style={{ fontSize: 19 }}>
              Route
            </Text>
            <View style={styles.dest}>
              <View style={styles.destDot} />
              <View style={{ flex: 1 }}>
                <Text variant="bodySm" numberOfLines={1} style={{ fontFamily: fonts.semibold }}>
                  {job.customerName}
                </Text>
                <Text variant="label" color={colors.textMuted} numberOfLines={1}>
                  {job.address}
                  {route && arrive && !working && !finished ? ` · arriving about ${clockAt(arrive)} · ${distanceLabel(route.distance)}${route.source === 'estimate' ? ' (estimated)' : ''}` : ''}
                </Text>
              </View>
            </View>
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

const styles = StyleSheet.create({
  handle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: colors.borderStrong, marginTop: -6, marginBottom: 2 },
  sheetTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  big: { fontSize: 36, lineHeight: 42, color: colors.text, fontFamily: fonts.bold },
  avatarRing: { padding: 3, borderRadius: 40, borderWidth: 3, borderColor: '#F2B705' },
  liveBadge: { position: 'absolute', right: 2, top: 2, width: 16, height: 16, borderRadius: 8, backgroundColor: colors.success, borderWidth: 3, borderColor: colors.white },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  notes: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, height: 56, borderRadius: 28, paddingHorizontal: 18, backgroundColor: colors.surfaceAlt },
  callBtn: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  route: { gap: 10, paddingTop: 12, borderTopWidth: 8, borderTopColor: colors.bgTop, marginHorizontal: -16, paddingHorizontal: 16 },
  destDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.brand, borderWidth: 2, borderColor: colors.white, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 2 },
  root: { flex: 1, backgroundColor: colors.bgTop },
  top: { position: 'absolute', left: 0, right: 0, top: 0, paddingHorizontal: space.lg, flexDirection: 'row', alignItems: 'center', gap: 10 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.glassStrong, borderRadius: 20, height: 40, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.glassBorder },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.md, gap: 10 },
  recenter: { alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface, borderRadius: 20, paddingHorizontal: 14, height: 38, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10 },
  card: { backgroundColor: colors.surface, borderRadius: radius.xl + 2, padding: space.lg, gap: 14, shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 20, shadowOffset: { width: 0, height: -2 } },
  dest: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  forward: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: 24, backgroundColor: colors.primary },
});
