import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { Attendance, Custody, MyStats, SerialUnit, Task } from '../../src/api/types';
import {
  AdminHero,
  AdminHeroBar,
  AttentionCard,
  BrandFooter,
  Button,
  CircleAction,
  Glass,
  GlassLink,
  lastDays,
  Pill,
  PillChart,
  ProgressRing,
  PulseDot,
  QuickActions,
  Reveal,
  Screen,
  Section,
  Skeleton,
  StarRating,
  Text,
  Timeline,
  type HeroStat,
  type TimelineItem,
} from '../../src/components';
import { useApi } from '../../src/hooks/useApi';
import { useAuth } from '../../src/store/auth';
import { colors, fonts } from '../../src/theme';
import { call } from '../../src/utils/contact';
import { date, duration, firstName, humanize, minutesSince, taskTypeIcon, time } from '../../src/utils/format';

interface Today {
  shiftStart: string;
  graceMinutes: number;
  record: (Attendance & { checkInPhoto?: { id: string } }) | null;
  custody: Custody;
}

const SHIFT_MINUTES = 8 * 60;
const PRIORITY_RANK = { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 } as const;

/** The job to do next: whatever is in progress, else the most urgent, earliest-due assigned job. */
function pickNext(jobs: Task[]) {
  const running = jobs.find((j) => j.status === 'IN_PROGRESS');
  if (running) return running;
  return [...jobs].sort(
    (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || (a.dueAt ?? '9').localeCompare(b.dueAt ?? '9') || a.createdAt.localeCompare(b.createdAt),
  )[0];
}

export default function TechHome() {
  const user = useAuth((s) => s.user)!;
  const today = useApi<Today>('/attendance/today', { poll: 60_000 });
  const open = useApi<{ tasks: Task[] }>('/tasks?status=IN_PROGRESS,ASSIGNED', { poll: 30_000 });
  const done = useApi<{ tasks: Task[] }>('/tasks?status=COMPLETED,VERIFIED', { poll: 120_000 });
  const stock = useApi<{ pending: SerialUnit[]; units: SerialUnit[] }>('/inventory/my', { poll: 60_000 });
  const unread = useApi<{ unread: number }>('/notifications/unread-count', { poll: 30_000 });
  const stats = useApi<MyStats>('/reports/me', { poll: 120_000 });
  const [tab, setTab] = useState<0 | 1>(0);

  // Re-render every 30 s so the shift ring and job timers tick without a network call.
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const record = today.data?.record;
  const shift: 'OFF' | 'ON' | 'DONE' = !record ? 'OFF' : record.checkOutAt ? 'DONE' : 'ON';
  const jobs = open.data?.tasks ?? [];
  const next = pickNext(jobs);
  const pending = stock.data?.pending ?? [];
  const held = (stock.data?.units.length ?? 0) + pending.length;
  const finished = done.data?.tasks ?? [];
  const week = lastDays(finished, (t) => t.endedAt);
  const worked = record ? (record.workedMinutes ?? minutesSince(record.checkInAt)) : 0;
  const lastReview = finished.filter((t) => t.ratedAt).sort((a, b) => (b.ratedAt ?? '').localeCompare(a.ratedAt ?? ''))[0];
  const firstLoad = !today.data && today.loading;

  const refresh = () => {
    today.refresh();
    open.refresh();
    done.refresh();
    stock.refresh();
    unread.refresh();
    stats.refresh();
  };

  const checkLink =
    shift === 'OFF'
      ? { label: 'Check in', icon: 'scan-outline' as const, onPress: () => router.push('/check-in?mode=in') }
      : shift === 'ON'
        ? { label: 'Check out', icon: 'log-out-outline' as const, onPress: () => router.push('/check-in?mode=out') }
        : { label: 'Shift complete', icon: 'checkmark-circle-outline' as const, onPress: () => router.push('/profile') };

  const s = stats.data;
  const todayStats: HeroStat[] = [
    { key: 'open', label: 'Open jobs', value: jobs.length, sub: `${jobs.filter((j) => j.status === 'IN_PROGRESS').length} in progress`, icon: 'briefcase', onPress: () => router.push('/jobs') },
    { key: 'dev', label: 'Devices held', value: held, sub: pending.length ? `${pending.length} to confirm` : 'All confirmed', icon: 'cube', alert: pending.length > 0, onPress: () => router.push('/stock') },
    { key: 'week', label: 'Done this week', value: s?.week.jobs ?? week.reduce((n, d) => n + d.value, 0), sub: s ? `avg ${duration(s.week.avgMinutes)} a job` : 'Completed jobs', icon: 'checkmark-done', onPress: () => router.push('/jobs') },
    { key: 'alerts', label: 'Alerts', value: unread.data?.unread ?? 0, sub: 'Unread messages', icon: 'notifications', alert: !!unread.data?.unread, onPress: () => router.push('/notifications') },
  ];
  const perfStats: HeroStat[] = [
    { key: 'rating', label: 'Customer rating', value: s?.rating.average ? s.rating.average.toFixed(1) : 'New', sub: s?.rating.count ? `${s.rating.count} review${s.rating.count === 1 ? '' : 's'}` : 'No reviews yet', icon: 'star', onPress: () => router.push('/profile') },
    { key: 'ontime', label: 'On-time check-ins', value: s?.month.onTimeRate != null ? `${s.month.onTimeRate}%` : '—', sub: `${s?.month.days ?? 0} day${s?.month.days === 1 ? '' : 's'} · last 30`, icon: 'time', alert: s?.month.onTimeRate != null && s.month.onTimeRate < 80, onPress: () => router.push('/profile') },
    { key: 'avg', label: 'Avg job time', value: duration(s?.month.avgMinutes), sub: `${s?.month.jobs ?? 0} jobs · last 30 days`, icon: 'stopwatch', onPress: () => router.push('/jobs') },
    { key: 'hours', label: 'Hours this week', value: s?.week.hours ?? 0, sub: `${s?.week.days ?? 0} day${s?.week.days === 1 ? '' : 's'} on duty`, icon: 'calendar', onPress: () => router.push('/profile') },
  ];

  const plan: TimelineItem[] = [...jobs]
    .sort((a, b) => (a.status === 'IN_PROGRESS' ? -1 : b.status === 'IN_PROGRESS' ? 1 : (a.dueAt ?? '9').localeCompare(b.dueAt ?? '9')))
    .slice(0, 6)
    .map((t) => ({
      key: t.id,
      time: t.status === 'IN_PROGRESS' ? 'Now' : t.dueAt ? time(t.dueAt) : '—',
      title: t.title,
      subtitle: `${t.customerName} · ${t.address}`,
      state: t.status === 'IN_PROGRESS' ? 'active' : t.id === next?.id ? 'next' : 'todo',
      right: t.priority === 'URGENT' || t.priority === 'HIGH' ? <Pill label={humanize(t.priority)} tone="danger" /> : undefined,
      onPress: () => router.push(`/task/${t.id}`),
    }));

  return (
    <Screen edges={[]} refreshing={open.refreshing || today.refreshing} onRefresh={refresh} contentStyle={{ gap: 18, paddingTop: 0 }} stickyHeader>
      <AdminHeroBar firstName={firstName(user.name)} unread={unread.data?.unread} updatedAt={open.updatedAt} onAvatar={() => router.push('/profile')} onSearch={() => router.push('/search')} onBell={() => router.push('/notifications')} />
      <View style={{ marginHorizontal: -16 }}>
        <AdminHero
          bar={false}
          firstName={firstName(user.name)}
          tabs={['Today', 'Performance']}
          tab={tab}
          onTab={setTab}
          link={checkLink}
          onViewAll={() => router.push('/jobs')}
          viewAllLabel="My jobs"
          loading={tab === 0 ? !open.data && open.loading : !s && stats.loading}
          stats={tab === 0 ? todayStats : perfStats}
        />
      </View>

      {pending.length ? (
        <Reveal index={1}>
          <AttentionCard
            icon="cube"
            title={`${pending.length} device${pending.length === 1 ? '' : 's'} waiting for you`}
            body="Confirm you received them — they stay in transit until you do."
            action="Confirm"
            onPress={() => router.push('/stock')}
          />
        </Reveal>
      ) : null}

      {/* Shift ring */}
      <Reveal index={2}>
        {firstLoad ? (
          <Skeleton height={170} radius={28} />
        ) : (
          <Glass strong style={styles.shift}>
            <ProgressRing progress={shift === 'OFF' ? 0 : worked / SHIFT_MINUTES} size={126} stroke={12} color={shift === 'DONE' ? colors.success : colors.highlight}>
              <Text variant="h2" style={{ fontFamily: fonts.semibold, fontSize: 17, lineHeight: 22 }}>
                {shift === 'OFF' ? '0h' : duration(worked)}
              </Text>
              <Text variant="label" color={colors.textMuted}>
                of 8h shift
              </Text>
            </ProgressRing>
            <View style={{ flex: 1, gap: 6 }}>
              <View style={styles.row}>
                {shift === 'ON' ? <PulseDot color={colors.success} size={7} /> : null}
                <Text variant="title" style={{ fontFamily: fonts.semibold, fontSize: 17 }}>
                  {shift === 'OFF' ? 'Not checked in' : shift === 'ON' ? 'On duty' : 'Shift complete'}
                </Text>
              </View>
              <Text variant="label" color={colors.textMuted}>
                {shift === 'OFF'
                  ? `Shift starts ${time(today.data?.shiftStart)} · ${today.data?.graceMinutes ?? 15} min grace`
                  : `In ${time(record?.checkInAt)}${record?.checkOutAt ? ` · out ${time(record.checkOutAt)}` : ''}`}
              </Text>
              {record ? (
                <View style={{ alignSelf: 'flex-start' }}>
                  <Pill label={record.status === 'LATE' ? 'Late' : 'On time'} tone={record.status === 'LATE' ? 'warning' : 'success'} />
                </View>
              ) : null}
              {shift !== 'DONE' ? (
                <Button
                  label={shift === 'OFF' ? 'Check in' : 'Check out'}
                  icon={shift === 'OFF' ? 'scan-outline' : 'log-out-outline'}
                  variant={shift === 'OFF' ? 'primary' : 'secondary'}
                  onPress={() => router.push(shift === 'OFF' ? '/check-in?mode=in' : '/check-in?mode=out')}
                />
              ) : null}
            </View>
          </Glass>
        )}
      </Reveal>

      {/* Up next */}
      <Reveal index={3}>
        {!open.data && open.loading ? (
          <Skeleton height={190} radius={28} />
        ) : next ? (
          <NextJob job={next} />
        ) : (
          <Glass strong style={{ alignItems: 'center', gap: 8, paddingVertical: 26 }}>
            <Ionicons name="sunny-outline" size={30} color={colors.text} />
            <Text variant="title">You’re all clear</Text>
            <Text variant="label" color={colors.textMuted} align="center">
              No open jobs. New assignments appear here instantly.
            </Text>
          </Glass>
        )}
      </Reveal>

      {/* Today’s plan */}
      {plan.length > 1 ? (
        <Reveal index={4}>
          <Section title="Today’s route" subtitle="In order — tap a stop to open it" action={{ label: 'All jobs', onPress: () => router.push('/jobs') }}>
            <Timeline items={plan} />
          </Section>
        </Reveal>
      ) : null}

      <Reveal index={5}>
        <Glass strong style={{ gap: 14 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Text variant="h1" style={styles.cardTitle}>
              {'Jobs done\nThis week'}
            </Text>
            <GlassLink label="All jobs" onPress={() => router.push('/jobs')} />
          </View>
          <PillChart data={week} activeIndex={week.length - 1} format={(n) => `${n} ${n === 1 ? 'job' : 'jobs'}`} />
        </Glass>
      </Reveal>

      {lastReview ? (
        <Reveal index={6}>
          <Glass strong style={{ gap: 10 }}>
            <Text variant="label" color={colors.textMuted} style={{ fontFamily: fonts.semibold, letterSpacing: 0.6 }}>
              LATEST CUSTOMER FEEDBACK
            </Text>
            <StarRating value={lastReview.customerRating ?? 0} size={22} />
            {lastReview.customerFeedback ? (
              <Text variant="body" style={{ fontFamily: fonts.medium }}>
                “{lastReview.customerFeedback}”
              </Text>
            ) : null}
            <Text variant="label" color={colors.textMuted}>
              {lastReview.customerName} · {lastReview.code} · {date(lastReview.ratedAt)}
            </Text>
          </Glass>
        </Reveal>
      ) : null}

      <Reveal index={7}>
        <QuickActions
          items={[
            { label: shift === 'ON' ? 'Check out' : 'Check in', icon: 'scan-outline', onPress: () => router.push(shift === 'ON' ? '/check-in?mode=out' : '/check-in?mode=in') },
            { label: 'My jobs', icon: 'briefcase-outline', onPress: () => router.push('/jobs') },
            { label: 'My stock', icon: 'cube-outline', onPress: () => router.push('/stock'), badge: pending.length },
            { label: 'Onboard customer', icon: 'person-add-outline', onPress: () => router.push('/onboard') },
            { label: 'Messages', icon: 'chatbubble-ellipses-outline', onPress: () => router.push('/messages') },
            { label: 'Search', icon: 'search-outline', onPress: () => router.push('/search') },
          ]}
        />
      </Reveal>

      <BrandFooter />
    </Screen>
  );
}

/** The next stop, with one-tap directions, call and open. Shows a live timer while the job is running. */
function NextJob({ job }: { job: Task }) {
  const running = job.status === 'IN_PROGRESS';
  return (
    <Glass strong onPress={() => router.push(`/task/${job.id}`)} style={{ gap: 14 }}>
      <View style={styles.row}>
        <View style={[styles.kicker, running && { backgroundColor: '#FEF3C7' }]}>
          {running ? <PulseDot color="#F59E0B" size={6} /> : <Ionicons name="navigate" size={12} color={colors.text} />}
          <Text variant="label" style={{ fontFamily: fonts.bold, fontSize: 11, letterSpacing: 0.6 }}>
            {running ? `IN PROGRESS · ${duration(minutesSince(job.startedAt))}` : 'UP NEXT'}
          </Text>
        </View>
        <View style={{ flex: 1 }} />
        <Pill label={humanize(job.priority)} tone={job.priority === 'URGENT' || job.priority === 'HIGH' ? 'danger' : 'neutral'} />
      </View>
      <View style={styles.row}>
        <View style={styles.typeIcon}>
          <Ionicons name={taskTypeIcon[job.type]} size={20} color={colors.onHighlight} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="h2" numberOfLines={2} style={{ fontFamily: fonts.semibold, fontSize: 19, lineHeight: 24 }}>
            {job.title}
          </Text>
          <Text variant="label" color={colors.textMuted}>
            {job.code} · {humanize(job.type)}
            {job.dueAt ? ` · due ${time(job.dueAt)}` : ''}
          </Text>
        </View>
      </View>
      <View style={styles.meta}>
        <View style={styles.row}>
          <Ionicons name="person-outline" size={15} color={colors.textMuted} />
          <Text variant="bodySm" numberOfLines={1} style={{ flex: 1 }}>
            {job.customerName}
            {job.customerAccount ? ` · ${job.customerAccount}` : ''}
          </Text>
        </View>
        <View style={styles.row}>
          <Ionicons name="location-outline" size={15} color={colors.textMuted} />
          <Text variant="bodySm" numberOfLines={2} style={{ flex: 1 }}>
            {job.address}
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        <CircleAction icon="navigate-outline" label="Navigate" onPress={() => router.push(`/navigate/${job.id}`)} />
        <CircleAction icon="call-outline" label="Call" onPress={job.customerPhone ? () => call(job.customerPhone) : undefined} />
        <CircleAction icon={running ? 'flag-outline' : 'play'} label={running ? 'Finish' : 'Start'} primary onPress={() => router.push(`/task/${job.id}`)} />
      </View>
    </Glass>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  shift: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  cardTitle: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 22 },
  kicker: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, height: 26, borderRadius: 13, backgroundColor: colors.highlight },
  typeIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.highlight, alignItems: 'center', justifyContent: 'center' },
  meta: { gap: 8, padding: 12, borderRadius: 18, backgroundColor: 'rgba(28,29,31,0.04)' },
  actions: { flexDirection: 'row', justifyContent: 'space-around' },
});
