import type { Attendance } from '../../src/api/types';
import { router } from 'expo-router';
import { Badge, ListRow, LocationSetting, ProfileView, Screen, SectionHeader, StatGrid, StatTile } from '../../src/components';
import { useApi } from '../../src/hooks/useApi';
import { colors } from '../../src/theme';
import { date, duration, time } from '../../src/utils/format';

export default function Profile() {
  const stats = useApi<{ daysPresent: number; lateDays: number; completedThisMonth: number; hoursWorked: number }>('/reports/me');
  const history = useApi<{ records: Attendance[] }>('/attendance/history');
  return (
    <Screen refreshing={history.refreshing} onRefresh={history.refresh}>
      <ProfileView>
        <StatGrid>
          <StatTile icon="calendar" label="Days present" value={stats.data?.daysPresent ?? '–'} tint={colors.info} />
          <StatTile icon="alarm-outline" label="Late arrivals" value={stats.data?.lateDays ?? '–'} tint={colors.warning} />
        </StatGrid>
        <LocationSetting />
        <ListRow icon="key-outline" iconTint={colors.text} title="Change password" onPress={() => router.push('/change-password')} />
        <ListRow icon="search" iconTint={colors.text} title="Search my jobs and devices" onPress={() => router.push('/search')} />
        <SectionHeader title="Attendance history" />
        {history.data?.records.slice(0, 20).map((r) => (
          <ListRow
            key={r.id}
            icon={r.status === 'LATE' ? 'alarm-outline' : 'checkmark-circle-outline'}
            iconTint={r.status === 'LATE' ? colors.warning : colors.success}
            title={date(r.workDate)}
            subtitle={`In ${time(r.checkInAt)} · Out ${time(r.checkOutAt)} · ${duration(r.workedMinutes)}`}
            right={
              r.dressReview === 'REJECTED' ? (
                <Badge label="Dress code" tone="danger" />
              ) : r.dressReview === 'APPROVED' ? (
                <Badge label="Approved" tone="success" />
              ) : undefined
            }
          />
        ))}
      </ProfileView>
    </Screen>
  );
}
