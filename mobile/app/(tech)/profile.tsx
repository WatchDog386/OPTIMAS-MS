import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import type { Attendance } from '../../src/api/types';
import { SmeProfilePage } from '../../src/components/SmeProfile';
import { SME, SmeRow, SmeSection } from '../../src/components/SmeKit';
import { Text } from '../../src/components';
import { useApi } from '../../src/hooks/useApi';
import { fonts } from '../../src/theme';
import { date, duration, time } from '../../src/utils/format';

/** The technician's profile: the Optimas-SME profile page, with this month's figures and attendance. */
export default function Profile() {
  const stats = useApi<{ daysPresent: number; lateDays: number; completedThisMonth: number; hoursWorked: number }>('/reports/me');
  const history = useApi<{ records: Attendance[] }>('/attendance/history');
  const unread = useApi<{ unread: number }>('/notifications/unread-count');
  const s = stats.data;
  return (
    <SmeProfilePage
      tools={[
        { key: 'day-report', icon: 'document-text-outline', title: 'Daily report', sub: 'Send the office today’s tasks (team leaders for the team)', onPress: () => router.push('/day-report') },
        { key: 'alerts', icon: 'notifications-outline', title: 'Notifications', sub: 'Tasks, stock and approvals', onPress: () => router.push('/notifications'), count: unread.data?.unread },
        { key: 'search', icon: 'search', title: 'Search', sub: 'My tasks and devices', onPress: () => router.push('/search') },
      ]}
    >
      <SmeSection title="This month">
        <View style={styles.stats}>
          <Stat value={s?.daysPresent} label="Days present" />
          <Stat value={s?.lateDays} label="Late arrivals" />
          <Stat value={s?.completedThisMonth} label="Tasks done" />
        </View>
      </SmeSection>
      {history.data?.records.length ? (
        <SmeSection title="Attendance history">
          {history.data.records.slice(0, 20).map((r) => (
            <SmeRow
              key={r.id}
              icon={r.status === 'LATE' ? 'alarm-outline' : 'checkmark-circle-outline'}
              iconColor={r.status === 'LATE' ? '#D97706' : '#2DA043'}
              title={`${date(r.workDate)}${r.dressReview === 'REJECTED' ? ' · dress code' : ''}`}
              sub={`In ${time(r.checkInAt)} · Out ${time(r.checkOutAt)} · ${duration(r.workedMinutes)}`}
            />
          ))}
        </SmeSection>
      ) : null}
    </SmeProfilePage>
  );
}

function Stat({ value, label }: { value?: number; label: string }) {
  return (
    <View style={styles.stat}>
      <Text variant="h1" color={SME.fg} fixedColor style={{ fontFamily: fonts.semibold, fontSize: 20 }}>
        {value ?? '–'}
      </Text>
      <Text variant="label" color={SME.fg3} fixedColor style={{ fontSize: 12 }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 14, borderRadius: 16, backgroundColor: SME.surface },
});
