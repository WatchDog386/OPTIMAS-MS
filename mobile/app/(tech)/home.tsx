import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { Attendance, Custody, SerialUnit, Task, TaskType } from '../../src/api/types';
import { Avatar, Button, Card, DiagonalAccent, Headline, Kicker, NotificationBell, Screen, Tag, Text } from '../../src/components';
import { useApi } from '../../src/hooks/useApi';
import { useAuth } from '../../src/store/auth';
import { brandShadow, colors, fonts, radius, shadow, space } from '../../src/theme';
import { duration, firstName, humanize, taskTypeIcon, time } from '../../src/utils/format';

interface Today {
  shiftStart: string;
  graceMinutes: number;
  record: Attendance | null;
  custody: Custody;
}
interface MyStats {
  openTasks: number;
  completedThisMonth: number;
  avgJobMinutes: number;
  daysPresent: number;
  lateDays: number;
  hoursWorked: number;
}

type Filter = 'ALL' | TaskType;
const FILTERS: { value: Filter; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'ALL', label: 'Today', icon: 'flame' },
  { value: 'INSTALLATION', label: 'Installs', icon: 'wifi' },
  { value: 'REPAIR', label: 'Repairs', icon: 'construct' },
  { value: 'RELOCATION', label: 'Moves', icon: 'swap-horizontal' },
  { value: 'SURVEY', label: 'Surveys', icon: 'map' },
];

export default function TechHome() {
  const user = useAuth((s) => s.user)!;
  const today = useApi<Today>('/attendance/today');
  const stats = useApi<MyStats>('/reports/me');
  const tasks = useApi<{ tasks: Task[] }>('/tasks?status=IN_PROGRESS,ASSIGNED');
  const stock = useApi<{ pending: SerialUnit[] }>('/inventory/my');
  const [filter, setFilter] = useState<Filter>('ALL');

  const record = today.data?.record;
  const state: 'OFF' | 'ON' | 'DONE' = !record ? 'OFF' : record.checkOutAt ? 'DONE' : 'ON';
  const pending = stock.data?.pending.length ?? 0;
  const jobs = useMemo(() => (tasks.data?.tasks ?? []).filter((t) => filter === 'ALL' || t.type === filter), [tasks.data, filter]);
  const refresh = () => {
    today.refresh();
    stats.refresh();
    tasks.refresh();
    stock.refresh();
  };

  const dateLabel = new Date().toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short' });
  const duty = {
    OFF: {
      headline: 'Ready for\ntoday’s shift',
      kicker: today.data ? `Shift starts ${time(today.data.shiftStart)} · ${today.data.graceMinutes} min grace` : 'Start your day',
      body: 'Confirm your uniform and take a live selfie to check in.',
      bigLabel: 'Starts',
      big: today.data ? time(today.data.shiftStart) : '--:--',
      icon: 'scan' as const,
    },
    ON: {
      headline: 'You’re\non duty',
      kicker: `In at ${time(record?.checkInAt)} · ${record?.status === 'LATE' ? 'Late' : 'On time'}`,
      body: 'Check out with a photo before you leave. Items you still hold will be listed.',
      bigLabel: 'In at',
      big: time(record?.checkInAt),
      icon: 'radio-button-on' as const,
    },
    DONE: {
      headline: 'Shift\ncomplete',
      kicker: `Worked ${duration(record?.workedMinutes)} today`,
      body: 'Great work today. See you tomorrow!',
      bigLabel: 'Worked',
      big: duration(record?.workedMinutes),
      icon: 'checkmark-circle' as const,
    },
  }[state];

  return (
    <Screen refreshing={today.refreshing || tasks.refreshing} onRefresh={refresh} contentStyle={{ gap: space.xl }}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <View style={{ flex: 1 }}>
          <Text variant="bodySm" color={colors.textMuted}>
            {dateLabel}
          </Text>
          <Text variant="h2" style={{ fontFamily: fonts.extrabold }}>
            Hi, {firstName(user.name)}
          </Text>
        </View>
        <NotificationBell />
        <Pressable onPress={() => router.push('/profile')} accessibilityLabel="Profile">
          <Avatar name={user.name} size={44} />
        </Pressable>
      </View>

      {/* Editorial duty card */}
      <View style={[styles.feature, shadow.raised]}>
        <DiagonalAccent />
        <View style={styles.featureBig} pointerEvents="none">
          <Ionicons name={duty.icon} size={30} color={colors.white} />
          <Text variant="label" color={colors.white} style={{ opacity: 0.85, textTransform: 'uppercase' }}>
            {duty.bigLabel}
          </Text>
          <Text variant="display" color={colors.white} style={{ fontFamily: fonts.extrabold }}>
            {duty.big}
          </Text>
        </View>

        <View style={styles.featureBody}>
          <Tag label={dateLabel} />
          <Headline>{duty.headline}</Headline>
          <Kicker>{duty.kicker}</Kicker>
          <Text variant="bodySm" color={colors.textMuted}>
            {duty.body}
          </Text>
          <View style={styles.actions}>
            {state === 'OFF' ? (
              <>
                <Button label="Check in" caps trailingIcon="arrow-forward-circle-outline" onPress={() => router.push('/check-in?mode=in')} />
                <Button label="My jobs" caps variant="secondary" onPress={() => router.push('/jobs')} />
              </>
            ) : state === 'ON' ? (
              <>
                <Button label="Check out" caps trailingIcon="arrow-forward-circle-outline" onPress={() => router.push('/check-in?mode=out')} />
                <Button label="My stock" caps variant="secondary" onPress={() => router.push('/stock')} />
              </>
            ) : (
              <Button label="My jobs" caps trailingIcon="arrow-forward-circle-outline" onPress={() => router.push('/jobs')} />
            )}
          </View>
        </View>
      </View>

      {pending > 0 ? (
        <Pressable onPress={() => router.push('/stock')} style={styles.alert}>
          <View style={styles.alertIcon}>
            <Ionicons name="cube" size={20} color={colors.white} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="title" style={{ fontFamily: fonts.bold }}>
              {pending} item(s) to confirm
            </Text>
            <Text variant="bodySm" color={colors.textMuted}>
              Confirm receipt of stock issued to you.
            </Text>
          </View>
          <Ionicons name="arrow-forward-circle" size={26} color={colors.brand} />
        </Pressable>
      ) : null}

      {/* Jobs */}
      <View style={styles.sectionRow}>
        <Headline size={20}>Your jobs</Headline>
        <Pressable onPress={() => router.push('/jobs')} hitSlop={10}>
          <Text variant="label" color={colors.brand} style={{ fontFamily: fonts.bold }}>
            SEE ALL
          </Text>
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pills} style={styles.bleed}>
        {FILTERS.map((f) => {
          const active = f.value === filter;
          return (
            <Pressable
              key={f.value}
              onPress={() => setFilter(f.value)}
              accessibilityLabel={f.label}
              style={[styles.pill, active ? styles.pillActive : styles.pillIdle]}
            >
              <Ionicons name={f.icon} size={16} color={active ? colors.white : colors.primary} />
              {active ? (
                <Text variant="label" color={colors.white} style={{ fontFamily: fonts.bold }}>
                  {f.label}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carousel} style={styles.bleed} decelerationRate="fast" snapToInterval={252}>
        {jobs.length ? (
          jobs.map((t) => <JobTile key={t.id} task={t} />)
        ) : (
          <View style={styles.emptyTile}>
            <Ionicons name="briefcase-outline" size={26} color={colors.textDim} />
            <Text variant="title">No jobs here</Text>
            <Text variant="bodySm" color={colors.textMuted} align="center">
              New jobs assigned to you will appear in this row.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Month strip */}
      <Headline size={20}>This month</Headline>
      <View style={[styles.strip, shadow.card]}>
        <Metric value={stats.data?.completedThisMonth ?? '–'} label="Jobs done" />
        <View style={styles.vr} />
        <Metric value={duration(stats.data?.avgJobMinutes)} label="Avg. job" />
        <View style={styles.vr} />
        <Metric value={stats.data?.daysPresent ?? '–'} label="Days in" accent={stats.data?.lateDays ? `${stats.data.lateDays} late` : undefined} />
        <View style={styles.vr} />
        <Metric value={stats.data?.hoursWorked ?? '–'} label="Hours" />
      </View>
    </Screen>
  );
}

function JobTile({ task }: { task: Task }) {
  const urgent = task.priority === 'URGENT' || task.priority === 'HIGH';
  return (
    <Card variant="hero" padded={false} onPress={() => router.push(`/task/${task.id}`)} style={styles.tile}>
      <DiagonalAccent size={150} right={-70} bottom={-80} outline={false} />
      <View style={styles.tileInner}>
        <View style={styles.tileTop}>
          <Tag label={humanize(task.type)} tone="white" />
          {task.status === 'IN_PROGRESS' ? (
            <Tag label="Live" tone="brand" />
          ) : urgent ? (
            <View style={styles.urgent}>
              <Ionicons name="flash" size={12} color={colors.brand} />
              <Text variant="label" color={colors.brand} style={{ fontFamily: fonts.bold }}>
                {humanize(task.priority)}
              </Text>
            </View>
          ) : null}
        </View>
        <View style={{ gap: 4 }}>
          <Text variant="title" numberOfLines={2} style={{ fontFamily: fonts.bold, fontSize: 17, lineHeight: 21 }}>
            {task.title}
          </Text>
          <View style={styles.meta}>
            <Ionicons name={taskTypeIcon[task.type]} size={13} color={colors.onHeroMuted} />
            <Text variant="label" color={colors.textMuted} numberOfLines={1} style={{ flex: 1 }}>
              {task.customerName}
            </Text>
          </View>
        </View>
        <View style={styles.tileBottom}>
          <View style={[styles.meta, { flex: 1 }]}>
            <Ionicons name="location-outline" size={13} color={colors.onHeroMuted} />
            <Text variant="label" color={colors.textMuted} numberOfLines={1} style={{ flex: 1 }}>
              {task.address}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text variant="label" color={colors.white} style={{ fontFamily: fonts.bold, fontSize: 10, letterSpacing: 1, opacity: 0.85 }}>
              {task.dueAt ? 'DUE' : 'JOB'}
            </Text>
            <Text variant="display" style={{ fontFamily: fonts.extrabold, fontSize: 26, lineHeight: 30 }}>
              {task.dueAt ? time(task.dueAt) : task.code.slice(-4)}
            </Text>
          </View>
        </View>
      </View>
    </Card>
  );
}

function Metric({ value, label, accent }: { value: string | number; label: string; accent?: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <Text variant="h2" style={{ fontFamily: fonts.extrabold }}>
        {value}
      </Text>
      <Text variant="label" color={colors.textMuted}>
        {label}
      </Text>
      {accent ? (
        <Text variant="label" color={colors.brand} style={{ fontFamily: fonts.bold, fontSize: 10 }}>
          {accent}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  feature: { backgroundColor: colors.surface, borderRadius: radius.xl, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  featureBig: { position: 'absolute', top: space.xl, right: space.xl, alignItems: 'flex-end', gap: 2 },
  featureBody: { paddingHorizontal: space.xl, paddingBottom: space.xl, paddingTop: 150, gap: space.md },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.xs, flexWrap: 'wrap' },
  alert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.brandSoft,
    ...brandShadow,
    shadowOpacity: 0.12,
    elevation: 2,
  },
  alertIcon: { width: 42, height: 42, borderRadius: radius.md, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: -space.sm },
  bleed: { marginHorizontal: -space.xl },
  pills: { gap: space.sm, paddingHorizontal: space.xl },
  pill: { height: 40, minWidth: 40, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: space.md },
  pillActive: { backgroundColor: colors.primary, paddingHorizontal: space.lg },
  pillIdle: { backgroundColor: colors.surfaceAlt },
  carousel: { gap: space.md, paddingHorizontal: space.xl, paddingVertical: space.xs },
  tile: { width: 240, height: 210, borderRadius: radius.xl },
  tileInner: { flex: 1, padding: space.lg, justifyContent: 'space-between' },
  tileTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tileBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: space.md },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  urgent: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.heroInset, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  emptyTile: { width: 300, height: 190, borderRadius: radius.xl, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center', gap: 6, padding: space.xl },
  strip: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, paddingVertical: space.lg },
  vr: { width: 1, height: 36, backgroundColor: colors.border },
});
