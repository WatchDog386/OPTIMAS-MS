import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../src/api/client';
import type { LatLng, Route } from '../../src/api/field';
import type { Task } from '../../src/api/types';
import { Button, HeaderButton, Loading, MapCanvas, Text, type MapPin } from '../../src/components';
import { useApi } from '../../src/hooks/useApi';
import { useAuth } from '../../src/store/auth';
import { useLocation } from '../../src/store/location';
import { colors, fonts, radius, space } from '../../src/theme';
import { call } from '../../src/utils/contact';
import { askLocation, bearing, clockAt, distanceLabel, metres, minutesLabel, watchFix, type Fix } from '../../src/utils/location';
import { NATIVE, prefersReducedMotion, spring } from '../../src/utils/motion';
import { openChatWith } from '../../src/utils/chat';

/** Re-ask for a route after drifting this far from it, or this long after the last one while moving. */
const OFF_ROUTE_M = 70;
const REFRESH_MS = 90_000;
/** Close enough to the customer to call it arrived. */
const ARRIVED_M = 60;

interface Progress {
  remaining: number;
  eta: number;
  next: { instruction: string; distance: number } | null;
  stepIndex: number;
  offRoute: number;
}

/** Where along the route we are: metres left, time left and the next instruction. */
function progressOn(route: Route, me: LatLng): Progress {
  const g = route.geometry;
  const cum = [0];
  for (let i = 1; i < g.length; i += 1) cum.push(cum[i - 1] + metres(g[i - 1], g[i]));
  let idx = 0;
  let best = Infinity;
  g.forEach((p, i) => {
    const d = metres(p, me);
    if (d < best) (best = d), (idx = i);
  });
  const total = cum[cum.length - 1] || 1;
  const remaining = Math.max(0, total - cum[idx]) + Math.min(best, 30);
  const eta = route.duration * (remaining / Math.max(route.distance, 1));
  // Steps are anchored to the nearest point of the route; the next one is the first still ahead
  let next: Progress['next'] = null;
  let stepIndex = route.steps.length - 1;
  for (let s = 1; s < route.steps.length; s += 1) {
    const st = route.steps[s];
    let at = 0;
    let d = Infinity;
    g.forEach((p, i) => {
      const x = metres(p, [st.lat, st.lng]);
      if (x < d) (d = x), (at = i);
    });
    if (at > idx) {
      next = { instruction: st.instruction, distance: Math.max(0, cum[at] - cum[idx]) };
      stepIndex = s;
      break;
    }
  }
  return { remaining, eta, next, stepIndex, offRoute: best };
}

/** Icon for an instruction ("Turn left onto…", "At the roundabout…"). */
function turnIcon(text: string): keyof typeof Ionicons.glyphMap {
  const t = text.toLowerCase();
  if (t.includes('arrived')) return 'flag';
  if (t.includes('roundabout')) return 'sync';
  if (t.includes('u-turn')) return 'return-down-back';
  if (t.includes('left')) return 'arrow-back';
  if (t.includes('right')) return 'arrow-forward';
  return 'arrow-up';
}

/** In-app turn-by-turn navigation to a job: follows the phone, keeps the route fresh, shows the time left. */
export default function Navigate() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { data } = useApi<{ task: Task }>(`/tasks/${id}`);
  const task = data?.task;
  const site: LatLng | null = task?.lat != null && task?.lng != null ? [task.lat, task.lng] : null;

  const [fix, setFix] = useState<Fix | null>(null);
  const [denied, setDenied] = useState(false);
  const [route, setRoute] = useState<Route | null>(null);
  const [steps, setSteps] = useState(false);
  const [recenter, setRecenter] = useState(0);
  const [panned, setPanned] = useState(false);
  const [startedAt] = useState(Date.now());
  const [, tick] = useState(0);
  const lastRouteAt = useRef(0);
  const routeFrom = useRef<LatLng | null>(null);

  // Follow the phone
  useEffect(() => {
    if (!site) return;
    let stop = () => {};
    // Start from the last position the app already knows, then follow the phone
    const known = useLocation.getState().fix;
    if (known) setFix(known);
    let cancelled = false;
    void askLocation().then((ok) => {
      if (cancelled) return;
      if (!ok) return setDenied(true);
      stop = watchFix(setFix, () => setDenied(true));
    });
    return () => {
      cancelled = true;
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site?.[0], site?.[1]]);


  // Ask for a route at the start, when off it, and now and then while moving
  useEffect(() => {
    if (!fix || !site) return;
    const me: LatLng = [fix.lat, fix.lng];
    const off = route ? progressOn(route, me).offRoute : Infinity;
    const stale = Date.now() - lastRouteAt.current > REFRESH_MS && routeFrom.current && metres(routeFrom.current, me) > 150;
    if (route && off < OFF_ROUTE_M && !stale) return;
    if (Date.now() - lastRouteAt.current < 8_000) return;
    lastRouteAt.current = Date.now();
    routeFrom.current = me;
    api<{ route: Route }>(`/location/route?from=${me[0].toFixed(6)},${me[1].toFixed(6)}&to=${site[0]},${site[1]}`)
      .then((r) => setRoute(r.route))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fix, site?.[0], site?.[1]]);

  // The trip clock
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const me: LatLng | null = fix ? [fix.lat, fix.lng] : null;
  const progress = route && me ? progressOn(route, me) : null;
  const arrived = !!(me && site && metres(me, site) <= ARRIVED_M);
  const next = arrived ? { instruction: 'You have arrived at the customer', distance: 0 } : progress?.next ?? null;

  // The remaining part of the route (so the line shrinks behind you)
  const ahead = useMemo(() => {
    if (!route || !me) return route?.geometry ?? null;
    const g = route.geometry;
    let idx = 0;
    let best = Infinity;
    g.forEach((p, i) => {
      const d = metres(p, me);
      if (d < best) (best = d), (idx = i);
    });
    return [me, ...g.slice(idx + 1)];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, fix]);

  const pins: MapPin[] = [];
  if (site) pins.push({ id: 'site', kind: 'site', lat: site[0], lng: site[1] });
  if (me) pins.push({ id: 'me', kind: 'me', lat: me[0], lng: me[1], heading: fix?.heading ?? null, live: true });

  // The instruction banner slides in whenever the instruction changes
  const slide = useRef(new Animated.Value(1)).current;
  const lastInstruction = useRef('');
  useEffect(() => {
    if (!next || next.instruction === lastInstruction.current) return;
    lastInstruction.current = next.instruction;
    if (prefersReducedMotion()) return;
    slide.setValue(0);
    Animated.spring(slide, { toValue: 1, ...spring.pop, useNativeDriver: NATIVE }).start();
  }, [next, slide]);

  if (!task) return <Loading />;
  const elapsed = Math.floor((Date.now() - startedAt) / 1000);
  const back = () => (router.canGoBack() ? router.back() : router.replace(`/task/${task.id}`));

  if (!site) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top + 20 }]}>
        <Ionicons name="location-outline" size={44} color={colors.textMuted} />
        <Text variant="h2" align="center">
          This job has no map pin yet
        </Text>
        <Text variant="bodySm" color={colors.textMuted} align="center">
          {task.address}. Ask the office to pin the location, or call the customer for directions.
        </Text>
        {task.customerPhone ? <Button label="Call customer" icon="call" onPress={() => call(task.customerPhone)} /> : null}
        <Button label="Back" variant="ghost" onPress={back} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <MapCanvas
        pins={pins}
        route={arrived ? null : ahead}
        fitKey={route ? 'route' : 'site'}
        follow={route ? 'me' : null}
        recenterKey={recenter}
        padTop={140}
        padBottom={250}
        onUserPan={() => setPanned(true)}
        style={StyleSheet.absoluteFill}
      />

      {/* Next instruction */}
      <View style={[styles.top, { paddingTop: insets.top + 10 }]} pointerEvents="box-none">
        <HeaderButton icon="chevron-back" label="Back" onPress={back} />
        <Animated.View style={[styles.banner, arrived && { backgroundColor: colors.success }, { opacity: slide, transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }] }]}>
          <View style={styles.turn}>
            <Ionicons name={next ? turnIcon(next.instruction) : 'navigate'} size={26} color={colors.white} />
          </View>
          <View style={{ flex: 1 }}>
            {next && !arrived && next.distance > 0 ? (
              <Text variant="h2" color={colors.white} fixedColor style={{ fontSize: 22 }}>
                {distanceLabel(next.distance)}
              </Text>
            ) : null}
            <Text variant="title" color={colors.white} fixedColor numberOfLines={2}>
              {next?.instruction ?? (denied ? 'Allow location to start directions' : me ? 'Finding the best route…' : 'Finding where you are…')}
            </Text>
          </View>
        </Animated.View>
      </View>

      {/* Time, distance and actions */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 14 }]}>
        {panned ? (
          <Pressable onPress={() => (setRecenter((n) => n + 1), setPanned(false))} style={styles.recenter} accessibilityRole="button" accessibilityLabel="Recentre">
            <Ionicons name="locate" size={18} color={colors.text} />
            <Text variant="label" style={{ fontFamily: fonts.semibold }}>
              Recentre
            </Text>
          </Pressable>
        ) : null}
        <View style={styles.card}>
          {arrived ? (
            <>
              <Text variant="h2">You have arrived</Text>
              <Text variant="bodySm" color={colors.textMuted}>
                {task.customerName} · {task.address}
              </Text>
              <Button label={task.status === 'ASSIGNED' ? 'Open the job to start' : 'Open the job'} icon="briefcase" onPress={() => router.replace(`/task/${task.id}`)} />
            </>
          ) : (
            <>
              <View style={styles.etaRow}>
                <Text variant="display" style={styles.eta}>
                  {progress ? minutesLabel(progress.eta) : '—'}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text variant="title">{progress ? `Arrive ${clockAt(Date.now() + progress.eta * 1000)}` : 'Working out the route'}</Text>
                  <Text variant="bodySm" color={colors.textMuted}>
                    {progress ? `${distanceLabel(progress.remaining)} to go · driving ${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}` : task.address}
                  </Text>
                </View>
              </View>
              {route?.source === 'estimate' ? (
                <Text variant="label" color={colors.warning}>
                  Road map unavailable right now: time is estimated from the distance.
                </Text>
              ) : null}
            </>
          )}
          <View style={styles.actions}>
            <Action icon="list" label="Steps" onPress={() => setSteps(true)} disabled={!route} />
            <Action icon="call" label="Call" onPress={() => call(task.customerPhone)} disabled={!task.customerPhone} />
            <Action icon="chatbubble-ellipses" label="Chat" onPress={() => openChatWith({ taskId: task.id })} />
            <Action icon="close" label="End" onPress={back} />
          </View>
        </View>
      </View>

      {steps && route ? (
        <Pressable style={styles.scrim} onPress={() => setSteps(false)}>
          <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]} onPress={() => undefined}>
            <Text variant="h2">Directions</Text>
            <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ gap: 4 }}>
              {route.steps.map((s, i) => {
                const done = progress ? i < progress.stepIndex : false;
                return (
                  <View key={`${i}-${s.instruction}`} style={[styles.step, done && { opacity: 0.4 }]}>
                    <View style={styles.stepIcon}>
                      <Ionicons name={turnIcon(s.instruction)} size={18} color={colors.text} />
                    </View>
                    <Text variant="bodySm" style={{ flex: 1 }}>
                      {s.instruction}
                    </Text>
                    {s.distance ? (
                      <Text variant="label" color={colors.textMuted}>
                        {distanceLabel(s.distance)}
                      </Text>
                    ) : null}
                  </View>
                );
              })}
            </ScrollView>
            <Button label="Close" variant="secondary" onPress={() => setSteps(false)} />
          </Pressable>
        </Pressable>
      ) : null}
    </View>
  );
}

function Action({ icon, label, onPress, disabled }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [styles.action, disabled && { opacity: 0.35 }, pressed && { transform: [{ scale: 0.94 }] }]}>
      <View style={styles.actionIcon}>
        <Ionicons name={icon} size={20} color={colors.text} />
      </View>
      <Text variant="label">{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgTop },
  center: { alignItems: 'center', justifyContent: 'center', gap: 14, padding: 28 },
  top: { position: 'absolute', left: 0, right: 0, top: 0, paddingHorizontal: space.lg, flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  banner: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.navy, borderRadius: radius.xl, padding: 14, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } },
  turn: { width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.md, gap: 10 },
  recenter: { alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface, borderRadius: 20, paddingHorizontal: 14, height: 40, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10 },
  card: { backgroundColor: colors.surface, borderRadius: radius.xl + 2, padding: space.lg, gap: 12, shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 20, shadowOffset: { width: 0, height: -2 } },
  etaRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  eta: { fontSize: 34, lineHeight: 40, color: colors.success },
  actions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  action: { flex: 1, alignItems: 'center', gap: 4 },
  actionIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  scrim: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(15,18,16,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: space.xl, gap: 12 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  stepIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
});
