import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { Activity, ActivityEvent } from '../../src/api/approvals';
import type { TeamMember } from '../../src/api/types';
import { AuthImage, Avatar, Badge, EmptyState, Glass, Reveal, Screen, ScreenHeader, Text } from '../../src/components';
import { useApi } from '../../src/hooks/useApi';
import { colors, fonts, radius, space } from '../../src/theme';
import { duration, firstName, flagLabel, humanize, time } from '../../src/utils/format';

const KIND: Record<string, { icon: keyof typeof Ionicons.glyphMap; tint: string }> = {
  CHECK_IN: { icon: 'log-in-outline', tint: colors.success },
  CHECK_OUT: { icon: 'log-out-outline', tint: colors.navy },
  JOB_START: { icon: 'play-outline', tint: colors.accent },
  JOB_END: { icon: 'flag-outline', tint: colors.accent },
  JOB_VERIFIED: { icon: 'shield-checkmark-outline', tint: colors.success },
  JOB_REJECTED: { icon: 'arrow-undo-outline', tint: colors.danger },
};
const STATUS: Record<string, { label: string; tone: 'success' | 'warning' | 'danger' | 'info' }> = {
  PENDING: { label: 'Waiting for review', tone: 'warning' },
  APPROVED: { label: 'Approved', tone: 'success' },
  REJECTED: { label: 'Sent back', tone: 'danger' },
  COMPLETED: { label: 'Waiting for verification', tone: 'warning' },
  VERIFIED: { label: 'Verified', tone: 'success' },
};

const localDate = (d: Date) => new Date(d.getTime() + 3 * 3_600_000).toISOString().slice(0, 10);
const shift = (date: string, days: number) => localDate(new Date(new Date(`${date}T12:00:00Z`).getTime() + days * 86_400_000 - 3 * 3_600_000));
const label = (date: string) => {
  const today = localDate(new Date());
  if (date === today) return 'Today';
  if (date === shift(today, -1)) return 'Yesterday';
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short' });
};

/** One technician's whole day, minute by minute: check-in, each job with its photos, stock, check-out, reviews. */
export default function ActivityScreen() {
  const params = useLocalSearchParams<{ userId?: string; date?: string }>();
  const team = useApi<{ users: TeamMember[] }>('/users?role=TECHNICIAN');
  const techs = useMemo(() => team.data?.users ?? [], [team.data]);
  const [userId, setUserId] = useState<string | undefined>(params.userId);
  const [date, setDate] = useState(params.date ?? localDate(new Date()));
  const who = userId ?? techs[0]?.id;
  const { data, loading, refresh, refreshing } = useApi<Activity>(who ? `/approvals/activity?userId=${who}&date=${date}` : null);
  const today = localDate(new Date());

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <ScreenHeader title="Activity" subtitle="Everything a technician did, with the photos" />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {techs.map((t) => {
          const on = t.id === who;
          return (
            <Pressable key={t.id} onPress={() => setUserId(t.id)} style={[styles.person, on && styles.personOn]} accessibilityRole="button" accessibilityState={{ selected: on }}>
              <Avatar name={t.name} size={28} tint={on ? "#FFFFFF" : t.today ? colors.success : colors.textDim} />
              <Text variant="label" style={{ fontFamily: fonts.semibold }} color={on ? colors.onPrimary : colors.text} fixedColor={on}>
                {firstName(t.name)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.days}>
        <Pressable onPress={() => setDate((d) => shift(d, -1))} style={styles.dayBtn} hitSlop={8} accessibilityLabel="Previous day">
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </Pressable>
        <Text variant="title" style={{ flex: 1, textAlign: 'center', fontFamily: fonts.semibold }}>
          {label(date)}
        </Text>
        <Pressable onPress={() => setDate((d) => (d < today ? shift(d, 1) : d))} style={[styles.dayBtn, date >= today && { opacity: 0.3 }]} hitSlop={8} accessibilityLabel="Next day" disabled={date >= today}>
          <Ionicons name="chevron-forward" size={20} color={colors.text} />
        </Pressable>
      </View>

      {data ? (
        <Glass strong style={styles.summary}>
          <Stat value={String(data.summary.jobsDone)} label="Jobs done" />
          <Stat value={data.summary.minutesWorked != null ? duration(data.summary.minutesWorked) : data.summary.checkedIn ? 'On shift' : '—'} label="Worked" />
          <Stat value={String(data.summary.photos)} label="Photos" />
          <Stat value={String(data.summary.flags)} label="Warnings" alert={data.summary.flags > 0} />
        </Glass>
      ) : null}

      {data && !loading && data.events.length === 0 ? (
        <EmptyState icon="calendar-outline" title={`Nothing recorded ${label(date) === 'Today' ? 'yet today' : 'this day'}`} message={`${firstName(data.user.name)} did not check in or do any work on this day.`} />
      ) : null}

      <View>
        {data?.events.map((e, i) => (
          <Reveal key={`${e.kind}-${e.at}-${i}`} index={Math.min(i, 8)}>
            <EventRow e={e} last={i === data.events.length - 1} who={data.user.name} />
          </Reveal>
        ))}
      </View>
    </Screen>
  );
}

function EventRow({ e, last, who }: { e: ActivityEvent; last: boolean; who: string }) {
  const k = KIND[e.kind] ?? { icon: 'cube-outline' as const, tint: colors.textMuted };
  const st = e.status ? STATUS[e.status] : undefined;
  return (
    <View style={styles.event}>
      <View style={styles.rail}>
        <View style={[styles.dot, { backgroundColor: k.tint }]}>
          <Ionicons name={k.icon} size={15} color="#FFFFFF" />
        </View>
        {!last ? <View style={styles.line} /> : null}
      </View>
      <Pressable onPress={e.taskId ? () => router.push(`/task/${e.taskId}`) : undefined} disabled={!e.taskId} style={styles.body}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text variant="label" style={{ fontFamily: fonts.bold }} color={colors.textMuted}>
            {time(e.at)}
          </Text>
          <Text variant="title" style={{ flex: 1 }} numberOfLines={2}>
            {e.title}
          </Text>
        </View>
        {e.detail ? (
          <Text variant="bodySm" color={colors.textMuted}>
            {e.detail}
          </Text>
        ) : null}
        {e.photo ? (
          <View style={styles.photoRow}>
            <AuthImage photoId={e.photo.id} title={e.title} subtitle={`${who} · ${time(e.at)}`} flagged={e.photo.flags.length > 0} style={styles.thumb} />
            <View style={{ flex: 1, gap: 6 }}>
              {e.photo.flags.map((f) => (
                <Badge key={f} label={flagLabel[f] ?? humanize(f)} tone="warning" />
              ))}
              {e.photo.lat != null ? (
                <Text variant="label" color={colors.textDim}>
                  GPS {e.photo.lat.toFixed(4)}, {e.photo.lng?.toFixed(4)}
                  {e.photo.accuracyM != null ? ` · ±${Math.round(e.photo.accuracyM)} m` : ''}
                </Text>
              ) : null}
              {st ? <Badge label={st.label} tone={st.tone} /> : null}
            </View>
          </View>
        ) : st ? (
          <Badge label={st.label} tone={st.tone} />
        ) : null}
        {e.note ? (
          <Text variant="label" color={colors.danger}>
            “{e.note}”
          </Text>
        ) : null}
      </Pressable>
    </View>
  );
}

function Stat({ value, label: l, alert }: { value: string; label: string; alert?: boolean }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <Text variant="h2" style={{ fontFamily: fonts.semibold }} color={alert ? colors.warning : colors.text}>
        {value}
      </Text>
      <Text variant="label" color={colors.textMuted}>
        {l}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  person: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 4, paddingRight: 14, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.glassStrong, borderWidth: 1, borderColor: colors.glassBorder },
  personOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  days: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dayBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.glassStrong, borderWidth: 1, borderColor: colors.glassBorder },
  summary: { flexDirection: 'row', paddingVertical: space.lg },
  event: { flexDirection: 'row', gap: 12 },
  rail: { width: 30, alignItems: 'center' },
  dot: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  line: { flex: 1, width: 2, backgroundColor: colors.border, marginVertical: 4 },
  body: { flex: 1, gap: 6, paddingBottom: 20 },
  photoRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  thumb: { width: 112, aspectRatio: 3 / 4 },
});
