import { View } from 'react-native';
import { router } from 'expo-router';
import type { Attendance, Custody, SerialUnit, Task } from '../../src/api/types';
import {
  AuthImage,
  BrandFooter,
  Glass,
  GlassLink,
  GlassStatCard,
  GlassTopBar,
  lastDays,
  Pill,
  PillChart,
  Portrait,
  ProfileHero,
  QuickActions,
  Screen,
  Section,
  SectionRow,
  Text,
} from '../../src/components';
import { useApi } from '../../src/hooks/useApi';
import { useAuth } from '../../src/store/auth';
import { colors, fonts } from '../../src/theme';
import { duration, humanize, minutesSince, taskTypeIcon, time } from '../../src/utils/format';

interface Today {
  shiftStart: string;
  graceMinutes: number;
  record: (Attendance & { checkInPhoto?: { id: string } }) | null;
  custody: Custody;
}

const SHIFT_MINUTES = 8 * 60;

export default function TechHome() {
  const user = useAuth((s) => s.user)!;
  const today = useApi<Today>('/attendance/today');
  const open = useApi<{ tasks: Task[] }>('/tasks?status=IN_PROGRESS,ASSIGNED');
  const done = useApi<{ tasks: Task[] }>('/tasks?status=COMPLETED,VERIFIED');
  const stock = useApi<{ pending: SerialUnit[]; units: SerialUnit[] }>('/inventory/my');
  const unread = useApi<{ unread: number }>('/notifications/unread-count');

  const record = today.data?.record;
  const state: 'OFF' | 'ON' | 'DONE' = !record ? 'OFF' : record.checkOutAt ? 'DONE' : 'ON';
  const jobs = open.data?.tasks ?? [];
  const pending = stock.data?.pending ?? [];
  const confirmed = stock.data?.units.length ?? 0;
  const held = confirmed + pending.length;
  const week = lastDays(done.data?.tasks ?? [], (t) => t.endedAt);
  const worked = record ? (record.workedMinutes ?? minutesSince(record.checkInAt)) : 0;
  const refresh = () => {
    today.refresh();
    open.refresh();
    done.refresh();
    stock.refresh();
    unread.refresh();
  };

  return (
    <Screen refreshing={today.refreshing || open.refreshing} onRefresh={refresh} contentStyle={{ gap: 18 }}>
      <GlassTopBar profileHref="/profile" calendarHref="/profile" />

      <ProfileHero
        name={user.name}
        role={humanize(user.role)}
        stat={jobs.length}
        statLabel={jobs.length === 1 ? 'Open job today' : 'Open jobs today'}
        portrait={<Portrait name={user.name} photo={record?.checkInPhoto ? <AuthImage photoId={record.checkInPhoto.id} style={{ aspectRatio: undefined, height: '100%', borderRadius: 0 }} /> : undefined} />}
      />

      {/* Jobs completed this week */}
      <Glass strong style={{ gap: 14 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Text variant="h1" style={{ fontFamily: fonts.medium, fontSize: 24, lineHeight: 29 }}>
            {'Jobs done\nThis week'}
          </Text>
          <GlassLink label="All jobs" onPress={() => router.push('/jobs')} />
        </View>
        <PillChart data={week} activeIndex={week.length - 1} format={(n) => `${n} ${n === 1 ? 'job' : 'jobs'}`} />
      </Glass>

      {/* Shift */}
      <GlassStatCard
        title={state === 'OFF' ? 'Today’s shift' : state === 'ON' ? 'On duty' : 'Shift done'}
        value={state === 'OFF' ? time(today.data?.shiftStart) : duration(worked)}
        progress={Math.min(1, worked / SHIFT_MINUTES)}
        progressLabel={state === 'OFF' ? 'Not checked in' : `${Math.round(Math.min(1, worked / SHIFT_MINUTES) * 100)}% of 8h`}
        caption={state === 'OFF' ? 'Shift starts' : state === 'ON' ? `Checked in · ${record?.status === 'LATE' ? 'late' : 'on time'}` : 'Checked out at'}
        footer={state === 'OFF' ? time(today.data?.shiftStart) : state === 'ON' ? time(record?.checkInAt) : time(record?.checkOutAt)}
        secondaryIcon="calendar-outline"
        onSecondary={() => router.push('/profile')}
        icon={state === 'ON' ? 'log-out-outline' : 'scan-outline'}
        onAction={state === 'DONE' ? undefined : () => router.push(state === 'ON' ? '/check-in?mode=out' : '/check-in?mode=in')}
      />

      {/* Devices */}
      <GlassStatCard
        title={'Devices\nIn custody'}
        value={held}
        progress={held ? confirmed / held : 0}
        progressLabel={held ? `${confirmed} of ${held} confirmed` : 'None issued'}
        caption={pending.length ? 'Waiting for you to confirm' : 'Status'}
        footer={pending.length ? `${pending.length} to confirm` : 'All confirmed'}
        secondaryIcon="barcode-outline"
        onSecondary={() => router.push('/stock')}
        icon="cube-outline"
        onAction={() => router.push('/stock')}
      />

      <QuickActions
        items={[
          { label: state === 'ON' ? 'Check out' : 'Check in', icon: 'scan-outline', onPress: () => router.push(state === 'ON' ? '/check-in?mode=out' : '/check-in?mode=in') },
          { label: 'My jobs', icon: 'briefcase-outline', onPress: () => router.push('/jobs') },
          { label: 'My stock', icon: 'cube-outline', onPress: () => router.push('/stock'), badge: pending.length },
          { label: 'Alerts', icon: 'notifications-outline', onPress: () => router.push('/notifications'), badge: unread.data?.unread },
        ]}
      />

      <Section title="Today’s jobs" subtitle="Photo at the start and at the finish" action={{ label: 'See all', onPress: () => router.push('/jobs') }}>
        {jobs.length === 0 ? (
          <Text variant="bodySm" color={colors.textDim} style={{ paddingHorizontal: 4 }}>
            No open jobs right now.
          </Text>
        ) : (
          jobs.slice(0, 5).map((t) => (
            <SectionRow
              key={t.id}
              icon={taskTypeIcon[t.type]}
              tint={colors.text}
              tintBg={colors.highlight}
              title={t.title}
              subtitle={`${t.customerName}${t.dueAt ? ` · due ${time(t.dueAt)}` : ''}`}
              right={
                t.status === 'IN_PROGRESS' ? (
                  <Pill label="In progress" tone="warning" />
                ) : t.priority === 'URGENT' || t.priority === 'HIGH' ? (
                  <Pill label={humanize(t.priority)} tone="danger" />
                ) : undefined
              }
              onPress={() => router.push(`/task/${t.id}`)}
            />
          ))
        )}
      </Section>

      <BrandFooter />
    </Screen>
  );
}
