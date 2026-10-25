import { router } from 'expo-router';
import { ListRow, ProfileView, Screen, SectionHeader } from '../../src/components';
import { useAuth } from '../../src/store/auth';
import { colors } from '../../src/theme';

export default function More() {
  const role = useAuth((s) => s.user?.role);
  const managers = role === 'ADMIN' || role === 'SUPERVISOR';
  return (
    <Screen>
      <ProfileView>
        <SectionHeader title="Controls" />
        {managers ? (
          <>
            <ListRow icon="shirt-outline" iconTint={colors.accent} title="Dress-code reviews" subtitle="Approve check-in photos" onPress={() => router.push('/admin/reviews')} />
            <ListRow icon="calendar-outline" iconTint={colors.info} title="Attendance register" subtitle="Check-in/out times, photos and absentees" onPress={() => router.push('/admin/attendance')} />
          </>
        ) : null}
        <ListRow icon="git-compare-outline" title="Stock reconciliation" subtitle="Issued vs. installed vs. in hand, per technician" onPress={() => router.push('/admin/reconciliation')} />
        <ListRow icon="list-outline" iconTint={colors.warning} title="Stock ledger" subtitle="Every movement, newest first" onPress={() => router.push('/admin/movements')} />
        <ListRow icon="search-outline" iconTint={colors.info} title="Trace a device" subtitle="Full chain of custody by serial number" onPress={() => router.push('/admin/unit')} />
      </ProfileView>
    </Screen>
  );
}
