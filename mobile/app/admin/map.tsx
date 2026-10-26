import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Defs, G, Line, LinearGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';
import type { LiveMap, MapState } from '../../src/api/insights';
import { Avatar, Badge, Glass, LiveBadge, Screen, ScreenHeader, Text } from '../../src/components';
import { useApi } from '../../src/hooks/useApi';
import { colors, fonts, space } from '../../src/theme';
import { dateTime, firstName } from '../../src/utils/format';

const STATE: Record<MapState, { label: string; color: string; tone: 'success' | 'warning' | 'neutral' }> = {
  ON_JOB: { label: 'On a job', color: colors.navy, tone: 'warning' },
  AVAILABLE: { label: 'Available', color: colors.success, tone: 'success' },
  OFFLINE: { label: 'Offline', color: '#9AA39E', tone: 'neutral' },
};
const PRIORITY: Record<string, string> = { URGENT: colors.danger, HIGH: colors.warning, NORMAL: '#3A8F91', LOW: '#9AA39E' };
const initials = (n: string) => n.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();

/** Where everyone is: technicians (last GPS photo today) and the jobs still open, on a simple area map. */
export default function LiveMapScreen() {
  const { data, refresh, refreshing, updatedAt } = useApi<LiveMap>('/insights/map', { poll: 30_000 });
  const [width, setWidth] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const height = 360;

  const staff = (data?.staff ?? []).filter((s) => s.lat != null && s.lng != null);
  const jobs = (data?.jobs ?? []).filter((j) => j.lat != null && j.lng != null);

  // Fit every point on the map with some air around it
  const project = useMemo(() => {
    const pts = [...staff.map((s) => [s.lat!, s.lng!]), ...jobs.map((j) => [j.lat!, j.lng!])];
    if (!pts.length || !width) return null;
    const lats = pts.map((p) => p[0]);
    const lngs = pts.map((p) => p[1]);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const pad = 34;
    const spanLat = Math.max(maxLat - minLat, 0.01);
    const spanLng = Math.max(maxLng - minLng, 0.01);
    // Keep real proportions: a degree of longitude is a little shorter than one of latitude near the equator
    const scale = Math.min((width - pad * 2) / spanLng, (height - pad * 2) / spanLat);
    const offX = (width - spanLng * scale) / 2;
    const offY = (height - spanLat * scale) / 2;
    return (lat: number, lng: number) => ({ x: offX + (lng - minLng) * scale, y: offY + (maxLat - lat) * scale });
  }, [staff, jobs, width]);

  const counts = { ON_JOB: 0, AVAILABLE: 0, OFFLINE: 0 } as Record<MapState, number>;
  for (const s of data?.staff ?? []) counts[s.state] += 1;
  const selected = data?.staff.find((s) => s.user.id === picked) ?? null;

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <ScreenHeader title="Live map" subtitle="Staff and open jobs" right={<LiveBadge updatedAt={updatedAt} />} />

      <View style={styles.legend}>
        {(Object.keys(STATE) as MapState[]).map((k) => (
          <View key={k} style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: STATE[k].color }]} />
            <Text variant="label" color={colors.textMuted}>
              {STATE[k].label} · {counts[k]}
            </Text>
          </View>
        ))}
        <View style={styles.legendItem}>
          <View style={[styles.square, { backgroundColor: PRIORITY.NORMAL }]} />
          <Text variant="label" color={colors.textMuted}>
            Open job · {data?.jobs.length ?? 0}
          </Text>
        </View>
      </View>

      <Glass strong style={{ padding: 0, overflow: 'hidden' }}>
        <View onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))} style={{ height }}>
          {width > 0 ? (
            <Svg width={width} height={height}>
              <Defs>
                <LinearGradient id="land" x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0" stopColor="#EEF3EF" />
                  <Stop offset="1" stopColor="#DCE6DF" />
                </LinearGradient>
              </Defs>
              <Rect width={width} height={height} fill="url(#land)" />
              {/* streets */}
              {[0.18, 0.42, 0.66, 0.88].map((f) => (
                <Line key={`h${f}`} x1={0} x2={width} y1={height * f} y2={height * (f + (f > 0.5 ? -0.08 : 0.06))} stroke="#FFFFFF" strokeWidth={f === 0.42 ? 9 : 5} opacity={0.95} />
              ))}
              {[0.14, 0.38, 0.62, 0.84].map((f) => (
                <Line key={`v${f}`} x1={width * f} x2={width * (f + 0.07)} y1={0} y2={height} stroke="#FFFFFF" strokeWidth={f === 0.38 ? 9 : 5} opacity={0.95} />
              ))}
              {/* jobs */}
              {project &&
                jobs.map((j) => {
                  const p = project(j.lat!, j.lng!);
                  const c = PRIORITY[j.priority] ?? PRIORITY.NORMAL;
                  return (
                    <G key={j.id} onPress={() => router.push(`/task/${j.id}`)}>
                      <Rect x={p.x - 7} y={p.y - 7} width={14} height={14} rx={4} fill={c} stroke="#FFFFFF" strokeWidth={2} />
                    </G>
                  );
                })}
              {/* people */}
              {project &&
                staff.map((s) => {
                  const p = project(s.lat!, s.lng!);
                  const on = picked === s.user.id;
                  return (
                    <G key={s.user.id} onPress={() => setPicked(on ? null : s.user.id)}>
                      {s.state !== 'OFFLINE' ? <Circle cx={p.x} cy={p.y} r={on ? 26 : 20} fill={STATE[s.state].color} opacity={0.14} /> : null}
                      <Circle cx={p.x} cy={p.y} r={14} fill={STATE[s.state].color} stroke={on ? colors.highlight : '#FFFFFF'} strokeWidth={on ? 4 : 3} />
                      <SvgText x={p.x} y={p.y + 4} fontSize={10} fontFamily={fonts.bold} fill="#FFFFFF" textAnchor="middle">
                        {initials(s.user.name)}
                      </SvgText>
                    </G>
                  );
                })}
            </Svg>
          ) : null}
          {width > 0 && !project ? (
            <View style={styles.empty}>
              <Ionicons name="location-outline" size={28} color={colors.textDim} />
              <Text variant="bodySm" color={colors.textMuted} align="center">
                No locations yet today. Technicians appear here once they check in or take a job photo with GPS on.
              </Text>
            </View>
          ) : null}
        </View>
      </Glass>

      {selected ? (
        <Glass strong style={{ gap: 6 }}>
          <View style={styles.personRow}>
            <Avatar name={selected.user.name} tint={STATE[selected.state].color} />
            <View style={{ flex: 1 }}>
              <Text variant="title">{selected.user.name}</Text>
              <Text variant="label" color={colors.textMuted}>
                {selected.seenAt ? `Last seen ${dateTime(selected.seenAt)}` : 'No location today'}
              </Text>
            </View>
            <Badge label={STATE[selected.state].label} tone={STATE[selected.state].tone} />
          </View>
          {selected.currentTask ? (
            <Text variant="bodySm" color={colors.textMuted}>
              Working on {selected.currentTask.code} · {selected.currentTask.title}
            </Text>
          ) : null}
        </Glass>
      ) : null}

      <Text variant="h2" style={{ marginLeft: 4 }}>
        People
      </Text>
      <Glass strong style={{ padding: 0, overflow: 'hidden' }}>
        {(data?.staff ?? []).map((s, i) => (
          <Pressable key={s.user.id} onPress={() => setPicked(s.user.id)} style={[styles.row, i > 0 && styles.rowLine]} accessibilityRole="button">
            <Avatar name={s.user.name} tint={STATE[s.state].color} />
            <View style={{ flex: 1 }}>
              <Text variant="title">{firstName(s.user.name)}</Text>
              <Text variant="label" color={colors.textMuted} numberOfLines={1}>
                {s.currentTask ? `${s.currentTask.code} · ${s.currentTask.title}` : s.state === 'OFFLINE' ? 'Not checked in' : 'Free for the next job'}
              </Text>
            </View>
            <Badge label={STATE[s.state].label} tone={STATE[s.state].tone} />
          </Pressable>
        ))}
      </Glass>

      <Text variant="h2" style={{ marginLeft: 4 }}>
        Jobs waiting
      </Text>
      <Glass strong style={{ padding: 0, overflow: 'hidden' }}>
        {(data?.jobs ?? []).map((j, i) => (
          <Pressable key={j.id} onPress={() => router.push(`/task/${j.id}`)} style={[styles.row, i > 0 && styles.rowLine]} accessibilityRole="button">
            <View style={[styles.jobIcon, { backgroundColor: PRIORITY[j.priority] ?? PRIORITY.NORMAL }]}>
              <Ionicons name="briefcase" size={16} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="title" numberOfLines={1}>
                {j.title}
              </Text>
              <Text variant="label" color={colors.textMuted} numberOfLines={1}>
                {j.address} · {j.assigneeName}
              </Text>
            </View>
            <Badge label={j.status === 'IN_PROGRESS' ? 'In progress' : 'Assigned'} tone={j.status === 'IN_PROGRESS' ? 'warning' : 'neutral'} />
          </Pressable>
        ))}
      </Glass>
    </Screen>
  );
}

const styles = StyleSheet.create({
  empty: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center', gap: 8, padding: space.xl },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: space.lg },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  square: { width: 10, height: 10, borderRadius: 3 },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: space.lg, paddingVertical: 12 },
  rowLine: { borderTopWidth: 1, borderTopColor: colors.border },
  jobIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
