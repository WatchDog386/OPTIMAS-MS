import { router } from 'expo-router';
import type { Attendance, Custody, SerialUnit, Task } from '../../src/api/types';
import {
  BankCard,
  BrandFooter,
  CardCarousel,
  DashboardHeader,
  Pill,
  QuickActions,
  Screen,
  Section,
  SectionRow,
  Text,
} from '../../src/components';
import { useApi } from '../../src/hooks/useApi';
import { useAuth } from '../../src/store/auth';
import { cardThemes, colors } from '../../src/theme';
import { duration, firstName, greeting, humanize, taskTypeIcon, time } from '../../src/utils/format';

interface Today {
  shiftStart: string;
  graceMinutes: number;
  record: Attendance | null;
  custody: Custody;
}

const digits = (s: string) => s.replace(/\D/g, '').slice(-4) || '0000';

export default function TechHome() {
  const user = useAuth((s) => s.user)!;
  const today = useApi<Today>('/attendance/today');
  const tasks = useApi<{ tasks: Task[] }>('/tasks?status=IN_PROGRESS,ASSIGNED');
  const stock = useApi<{ pending: SerialUnit[]; units: SerialUnit[] }>('/inventory/my');
  const unread = useApi<{ unread: number }>('/notifications/unread-count');

  const record = today.data?.record;
  const state: 'OFF' | 'ON' | 'DONE' = !record ? 'OFF' : record.checkOutAt ? 'DONE' : 'ON';
  const jobs = tasks.data?.tasks ?? [];
  const inProgress = jobs.filter((t) => t.status === 'IN_PROGRESS').length;
  const pending = stock.data?.pending ?? [];
  const held = (stock.data?.units.length ?? 0) + pending.length;
  const refresh = () => {
    today.refresh();
    tasks.refresh();
    stock.refresh();
    unread.refresh();
  };

  const shift = {
    OFF: { label: 'Today’s shift', value: today.data ? time(today.data.shiftStart) : '--:--', note: 'start', right: 'Not checked in', action: { label: 'Check in', onPress: () => router.push('/check-in?mode=in') } },
    ON: {
      label: 'Checked in at',
      value: time(record?.checkInAt),
      note: record?.status === 'LATE' ? 'late' : 'on time',
      right: 'On duty',
      action: { label: 'Check out', onPress: () => router.push('/check-in?mode=out') },
    },
    DONE: { label: 'Worked today', value: duration(record?.workedMinutes), note: '', right: `Out ${time(record?.checkOutAt)}`, action: undefined },
  }[state];

  return (
    <Screen refreshing={today.refreshing || tasks.refreshing} onRefresh={refresh}>
      <DashboardHeader name={user.name} title={`${greeting()}, ${firstName(user.name)}`} profileHref="/profile" />

      <CardCarousel>
        {[
          <BankCard
            key="shift"
            theme={cardThemes.teal}
            label={shift.label}
            value={shift.value}
            note={shift.note}
            masked={digits(user.staffNo)}
            footerLeft={user.name}
            footerRight={shift.right}
            icon="time-outline"
            action={shift.action}
          />,
          <BankCard
            key="jobs"
            theme={cardThemes.charcoal}
            label="Open jobs"
            value={jobs.length}
            note={jobs.length === 1 ? 'job' : 'jobs'}
            masked={jobs.length}
            footerLeft={user.name}
            footerRight={`${inProgress} in progress`}
            icon="briefcase-outline"
            action={{ label: 'View jobs', onPress: () => router.push('/jobs') }}
          />,
          <BankCard
            key="stock"
            theme={cardThemes.garnet}
            label="Devices in custody"
            value={held}
            note="units"
            masked={held}
            footerLeft={user.name}
            footerRight={pending.length ? `${pending.length} to confirm` : 'All confirmed'}
            icon="wifi-outline"
            action={{ label: 'My stock', onPress: () => router.push('/stock') }}
          />,
        ]}
      </CardCarousel>

      <QuickActions
        items={[
          { label: state === 'ON' ? 'Check out' : 'Check in', icon: 'scan-outline', onPress: () => router.push(state === 'ON' ? '/check-in?mode=out' : '/check-in?mode=in') },
          { label: 'My jobs', icon: 'briefcase-outline', onPress: () => router.push('/jobs') },
          { label: 'My stock', icon: 'cube-outline', onPress: () => router.push('/stock'), badge: pending.length },
          { label: 'Stock count', icon: 'barcode-outline', onPress: () => router.push('/stock') },
          { label: 'Alerts', icon: 'notifications-outline', onPress: () => router.push('/notifications'), badge: unread.data?.unread },
          { label: 'Attendance', icon: 'calendar-outline', onPress: () => router.push('/profile') },
          { label: 'Completed', icon: 'checkmark-done-outline', onPress: () => router.push('/jobs') },
          { label: 'Profile', icon: 'person-outline', onPress: () => router.push('/profile') },
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

      {pending.length ? (
        <Section title="Stock to confirm" subtitle="Only confirm what you physically received" action={{ label: 'Confirm', onPress: () => router.push('/stock') }}>
          {pending.slice(0, 4).map((u) => (
            <SectionRow key={u.id} icon="cube-outline" tint={colors.garnet} tintBg={colors.garnetSoft} title={u.item.name} subtitle={`S/N ${u.serialNumber}`} right={<Pill label="Issued" tone="warning" />} />
          ))}
        </Section>
      ) : null}

      <BrandFooter />
    </Screen>
  );
}
