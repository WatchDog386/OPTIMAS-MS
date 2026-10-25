import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { Attendance, Custody, SerialUnit, Task } from '../../src/api/types';
import { Avatar, NotificationBell, Badge, Button, Card, EmptyState, Screen, SectionHeader, StatGrid, StatTile, TaskCard, Text } from '../../src/components';
import { useApi } from '../../src/hooks/useApi';
import { useAuth } from '../../src/store/auth';
import { colors, radius, space } from '../../src/theme';
import { duration, firstName, greeting, time } from '../../src/utils/format';

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

export default function TechHome() {
  const user = useAuth((s) => s.user)!;
  const today = useApi<Today>('/attendance/today');
  const stats = useApi<MyStats>('/reports/me');
  const tasks = useApi<{ tasks: Task[] }>('/tasks?status=IN_PROGRESS,ASSIGNED');
  const stock = useApi<{ pending: SerialUnit[] }>('/inventory/my');

  const record = today.data?.record;
  const state = !record ? 'OFF' : record.checkOutAt ? 'DONE' : 'ON';
  const pending = stock.data?.pending.length ?? 0;
  const refreshing = today.refreshing || stats.refreshing || tasks.refreshing;
  const refresh = () => {
    today.refresh();
    stats.refresh();
    tasks.refresh();
    stock.refresh();
  };

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text variant="bodySm" color={colors.textMuted}>
            {greeting()},
          </Text>
          <Text variant="h1">{firstName(user.name)} 👋</Text>
        </View>
        <NotificationBell />
        <Avatar name={user.name} />
      </View>

      {/* Duty card — the primary action of the day, like Spiro's swap CTA */}
      <Card variant="hero" style={{ gap: space.lg, padding: space.xl }}>
        <View style={styles.rowBetween}>
          <Text variant="overline" color={colors.textMuted}>
            {new Date().toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long' })}
          </Text>
          {state === 'ON' ? (
            <Badge label={record?.status === 'LATE' ? 'On duty · Late' : 'On duty'} tone={record?.status === 'LATE' ? 'warning' : 'success'} />
          ) : state === 'DONE' ? (
            <Badge label="Shift complete" tone="brand" />
          ) : (
            <Badge label="Not checked in" tone="neutral" />
          )}
        </View>

        <View style={styles.dutyRow}>
          <DutyStat label="Check in" value={time(record?.checkInAt)} />
          <View style={styles.divider} />
          <DutyStat label="Check out" value={time(record?.checkOutAt)} />
          <View style={styles.divider} />
          <DutyStat label="Worked" value={record?.workedMinutes != null ? duration(record.workedMinutes) : state === 'ON' ? 'Live' : '—'} />
        </View>

        {state === 'OFF' ? (
          <Button label="Check in for today" icon="scan" size="lg" onPress={() => router.push('/check-in?mode=in')} />
        ) : state === 'ON' ? (
          <Button label="Check out" icon="log-out-outline" size="lg" variant="secondary" onPress={() => router.push('/check-in?mode=out')} />
        ) : (
          <Text variant="bodySm" color={colors.textMuted} align="center">
            Great work today. See you tomorrow!
          </Text>
        )}
        {state === 'OFF' && today.data ? (
          <Text variant="label" color={colors.textMuted} align="center">
            Shift starts {time(today.data.shiftStart)} · {today.data.graceMinutes} min grace
          </Text>
        ) : null}
      </Card>

      {pending > 0 ? (
        <Card onPress={() => router.push('/stock')} style={styles.alert}>
          <View style={[styles.alertIcon, { backgroundColor: colors.warningSoft }]}>
            <Ionicons name="cube" size={20} color={colors.warning} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="title">{pending} item(s) awaiting your confirmation</Text>
            <Text variant="bodySm" color={colors.textMuted}>
              Confirm receipt of stock issued to you by the store.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
        </Card>
      ) : null}

      <SectionHeader title="This month" />
      <StatGrid>
        <StatTile icon="checkmark-done" label="Jobs completed" value={stats.data?.completedThisMonth ?? '–'} />
        <StatTile icon="timer-outline" label="Avg. job time" value={duration(stats.data?.avgJobMinutes)} tint={colors.accent} />
        <StatTile
          icon="calendar-outline"
          label="Days present"
          value={stats.data?.daysPresent ?? '–'}
          tint={colors.info}
          hint={stats.data?.lateDays ? `${stats.data.lateDays} late` : undefined}
        />
        <StatTile icon="time-outline" label="Hours worked" value={stats.data?.hoursWorked ?? '–'} tint={colors.warning} />
      </StatGrid>

      <SectionHeader title="Today's jobs" action="See all" onAction={() => router.push('/jobs')} />
      {tasks.data?.tasks.length ? (
        tasks.data.tasks.slice(0, 3).map((t) => <TaskCard key={t.id} task={t} />)
      ) : (
        <EmptyState icon="briefcase-outline" title="No open jobs" message="New jobs assigned to you will appear here." />
      )}
    </Screen>
  );
}

function DutyStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <Text variant="h2">{value}</Text>
      <Text variant="label" color={colors.textMuted}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dutyRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.heroInset, borderRadius: radius.md, paddingVertical: space.lg },
  divider: { width: 1, height: 32, backgroundColor: colors.heroBorder },
  alert: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderWidth: 1, borderColor: `${colors.warning}40`, backgroundColor: colors.warningSoft },
  alertIcon: { width: 42, height: 42, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
});
