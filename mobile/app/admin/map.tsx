import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { LiveMap, MapState } from '../../src/api/insights';
import { Avatar, Badge, Button, Glass, LiveBadge, MapCanvas, Reveal, Screen, ScreenHeader, Segmented, Text, type MapPin } from '../../src/components';
import { useApi } from '../../src/hooks/useApi';
import { colors, fonts, radius, space } from '../../src/theme';
import { call } from '../../src/utils/contact';
import { openChatWith } from '../../src/utils/chat';
import { dateTime, firstName, humanize } from '../../src/utils/format';

const STATE: Record<MapState, { label: string; color: string; tone: 'success' | 'warning' | 'neutral' }> = {
  ON_JOB: { label: 'On a job', color: colors.navy, tone: 'warning' },
  AVAILABLE: { label: 'Available', color: colors.success, tone: 'success' },
  OFFLINE: { label: 'Offline', color: '#9AA39E', tone: 'neutral' },
};
const PRIORITY: Record<string, string> = { URGENT: colors.danger, HIGH: colors.warning, NORMAL: '#3A8F91', LOW: '#9AA39E' };
const initials = (n: string) => n.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();

type Layer = 'ALL' | 'PEOPLE' | 'JOBS' | 'REQUESTS';
type Picked = { kind: 'tech' | 'job' | 'request'; id: string } | null;

/** Everyone and everything on a real street map: technicians moving live, open jobs and customer requests. */
export default function LiveMapScreen() {
  const { data, refresh, refreshing, updatedAt } = useApi<LiveMap>('/insights/map', { poll: 10_000 });
  const [layer, setLayer] = useState<Layer>('ALL');
  const [picked, setPicked] = useState<Picked>(null);
  const [recenter, setRecenter] = useState(0);

  const staff = data?.staff ?? [];
  const jobs = data?.jobs ?? [];
  const requests = data?.requests ?? [];
  const show = (l: Exclude<Layer, 'ALL'>) => layer === 'ALL' || layer === l;

  const pins = useMemo(() => {
    const out: MapPin[] = [];
    if (show('JOBS'))
      for (const j of jobs) if (j.lat != null && j.lng != null) out.push({ id: `job:${j.id}`, kind: 'job', lat: j.lat, lng: j.lng, color: PRIORITY[j.priority] ?? PRIORITY.NORMAL, label: j.status === 'IN_PROGRESS' ? '●' : '', selected: picked?.kind === 'job' && picked.id === j.id });
    if (show('REQUESTS'))
      for (const r of requests) if (r.lat != null && r.lng != null) out.push({ id: `request:${r.id}`, kind: 'request', lat: r.lat, lng: r.lng, selected: picked?.kind === 'request' && picked.id === r.id });
    if (show('PEOPLE'))
      for (const s of staff)
        if (s.lat != null && s.lng != null)
          out.push({ id: `tech:${s.user.id}`, kind: 'tech', lat: s.lat, lng: s.lng, label: initials(s.user.name), color: STATE[s.state].color, heading: s.heading ?? null, live: !!s.live, dim: s.state === 'OFFLINE', selected: picked?.kind === 'tech' && picked.id === s.user.id });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, layer, picked]);

  const counts = { ON_JOB: 0, AVAILABLE: 0, OFFLINE: 0 } as Record<MapState, number>;
  for (const s of staff) counts[s.state] += 1;
  const tech = picked?.kind === 'tech' ? staff.find((s) => s.user.id === picked.id) : null;
  const job = picked?.kind === 'job' ? jobs.find((j) => j.id === picked.id) : null;
  const request = picked?.kind === 'request' ? requests.find((r) => r.id === picked.id) : null;
  const onPin = (pinId: string) => {
    const [kind, id] = pinId.split(':') as ['tech' | 'job' | 'request', string];
    setPicked((p) => (p?.kind === kind && p.id === id ? null : { kind, id }));
  };

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <ScreenHeader title="Live map" subtitle="Technicians, jobs and requests" right={<LiveBadge updatedAt={updatedAt} />} />

      <Segmented<Layer>
        options={[
          { value: 'ALL', label: 'Everything' },
          { value: 'PEOPLE', label: `Team · ${staff.length}` },
          { value: 'JOBS', label: `Jobs · ${jobs.length}` },
          { value: 'REQUESTS', label: `Requests · ${requests.length}` },
        ]}
        value={layer}
        onChange={(v) => (setLayer(v), setPicked(null), setRecenter((n) => n + 1))}
      />

      <View style={styles.mapBox}>
        <MapCanvas pins={pins} fitKey={data ? 'loaded' : 'empty'} recenterKey={recenter} onPinPress={onPin} onMapPress={() => setPicked(null)} style={{ flex: 1 }} />
        <Pressable onPress={() => setRecenter((n) => n + 1)} style={styles.fit} accessibilityRole="button" accessibilityLabel="Show everything">
          <Ionicons name="scan-outline" size={18} color={colors.text} />
        </Pressable>
        {data && !pins.length ? (
          <View style={styles.empty} pointerEvents="none">
            <Text variant="bodySm" color={colors.textMuted} align="center">
              Nothing to show here yet. Technicians appear once they share their location or take a GPS photo.
            </Text>
          </View>
        ) : null}
      </View>

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
          <View style={[styles.dot, { backgroundColor: '#B98A00' }]} />
          <Text variant="label" color={colors.textMuted}>
            Request · {requests.length}
          </Text>
        </View>
      </View>

      {/* What was tapped on the map */}
      {tech ? (
        <Reveal index={0} key={`t${tech.user.id}`}>
          <Glass strong style={{ gap: 12 }}>
            <View style={styles.personRow}>
              <Avatar name={tech.user.name} tint={STATE[tech.state].color} />
              <View style={{ flex: 1 }}>
                <Text variant="title">{tech.user.name}</Text>
                <Text variant="label" color={colors.textMuted}>
                  {tech.live ? 'Sharing live location' : tech.seenAt ? `Last seen ${dateTime(tech.seenAt)}` : 'No location today'}
                </Text>
              </View>
              <Badge label={STATE[tech.state].label} tone={STATE[tech.state].tone} />
            </View>
            {tech.currentTask ? (
              <Text variant="bodySm" color={colors.textMuted}>
                Working on {tech.currentTask.code} · {tech.currentTask.title}
              </Text>
            ) : null}
            <View style={styles.actions}>
              <Button label="Message" icon="chatbubble-ellipses-outline" variant="secondary" style={{ flex: 1 }} onPress={() => openChatWith({ userId: tech.user.id })} />
              {tech.user.phone ? <Button label="Call" icon="call-outline" variant="secondary" style={{ flex: 1 }} onPress={() => call(tech.user.phone)} /> : null}
              <Button label="Profile" icon="person-outline" style={{ flex: 1 }} onPress={() => router.push(`/admin/user/${tech.user.id}`)} />
            </View>
          </Glass>
        </Reveal>
      ) : job ? (
        <Reveal index={0} key={`j${job.id}`}>
          <Glass strong style={{ gap: 10 }}>
            <View style={styles.personRow}>
              <View style={[styles.jobIcon, { backgroundColor: PRIORITY[job.priority] ?? PRIORITY.NORMAL }]}>
                <Ionicons name="briefcase" size={16} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="title" numberOfLines={1}>
                  {job.code} · {job.title}
                </Text>
                <Text variant="label" color={colors.textMuted} numberOfLines={1}>
                  {job.customerName ? `${job.customerName} · ` : ''}
                  {job.address}
                </Text>
              </View>
            </View>
            <Text variant="bodySm" color={colors.textMuted}>
              {job.status === 'IN_PROGRESS' ? `${job.assigneeName} is working on it` : `Assigned to ${job.assigneeName}`}
            </Text>
            <View style={styles.actions}>
              <Button label="Track" icon="navigate-outline" variant="secondary" style={{ flex: 1 }} onPress={() => router.push(`/track/${job.id}`)} />
              {job.status === 'ASSIGNED' ? <Button label="Nearest" icon="git-branch-outline" variant="secondary" style={{ flex: 1 }} onPress={() => router.push(`/admin/forward/${job.id}`)} /> : null}
              <Button label="Open" icon="open-outline" style={{ flex: 1 }} onPress={() => router.push(`/task/${job.id}`)} />
            </View>
          </Glass>
        </Reveal>
      ) : request ? (
        <Reveal index={0} key={`r${request.id}`}>
          <Glass strong style={{ gap: 10 }}>
            <Text variant="title">
              {humanize(request.type)} request · {request.customerName}
            </Text>
            <Text variant="bodySm" color={colors.textMuted}>
              {request.description}
            </Text>
            {request.address ? (
              <Text variant="label" color={colors.textMuted}>
                {request.address} · {dateTime(request.createdAt)}
              </Text>
            ) : null}
            <Button label="Schedule from requests" icon="calendar-outline" onPress={() => router.push('/admin/requests')} />
          </Glass>
        </Reveal>
      ) : null}

      <Text variant="h2" style={{ marginLeft: 4 }}>
        People
      </Text>
      <View>
        {staff.map((s) => (
          <Pressable key={s.user.id} onPress={() => (setLayer('ALL'), setPicked({ kind: 'tech', id: s.user.id }))} style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]} accessibilityRole="button">
            <Avatar name={s.user.name} tint={STATE[s.state].color} />
            <View style={{ flex: 1 }}>
              <Text variant="title">{firstName(s.user.name)}</Text>
              <Text variant="label" color={colors.textMuted} numberOfLines={1}>
                {s.currentTask ? `${s.currentTask.code} · ${s.currentTask.title}` : s.state === 'OFFLINE' ? 'Not checked in' : 'Free for the next job'}
              </Text>
            </View>
            {s.live ? (
              <View style={styles.liveDot}>
                <Text variant="label" color={colors.success} style={{ fontFamily: fonts.semibold }}>
                  Live
                </Text>
              </View>
            ) : null}
            <Badge label={STATE[s.state].label} tone={STATE[s.state].tone} />
          </Pressable>
        ))}
      </View>

      {requests.length ? (
        <>
          <Text variant="h2" style={{ marginLeft: 4 }}>
            Requests waiting
          </Text>
          <View>
            {requests.map((r) => (
              <Pressable key={r.id} onPress={() => (setLayer('ALL'), setPicked({ kind: 'request', id: r.id }))} style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]} accessibilityRole="button">
                <View style={[styles.jobIcon, { backgroundColor: '#B98A00' }]}>
                  <Text variant="title" color="#FFFFFF" fixedColor>
                    !
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="title" numberOfLines={1}>
                    {r.customerName}
                  </Text>
                  <Text variant="label" color={colors.textMuted} numberOfLines={1}>
                    {humanize(r.type)} · {r.address ?? 'No address'}
                  </Text>
                </View>
                {r.lat == null ? <Badge label="No pin" tone="neutral" /> : null}
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      <Text variant="h2" style={{ marginLeft: 4 }}>
        Jobs waiting
      </Text>
      <View>
        {jobs.map((j) => (
          <Pressable key={j.id} onPress={() => (setLayer('ALL'), setPicked({ kind: 'job', id: j.id }))} style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]} accessibilityRole="button">
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
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  mapBox: { height: 420, borderRadius: radius.xl, overflow: 'hidden', borderWidth: 1, borderColor: colors.glassBorder, backgroundColor: '#E9ECEA' },
  fit: { position: 'absolute', right: 12, top: 12, width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8 },
  empty: { position: 'absolute', left: 20, right: 20, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: space.lg },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  actions: { flexDirection: 'row', gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: space.md, paddingHorizontal: 2 },
  jobIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  liveDot: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: colors.successSoft },
});
