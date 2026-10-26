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
            <ListRow icon="people-outline" iconTint={colors.text} title="People" subtitle="Staff and customer accounts, passwords" onPress={() => router.push('/admin/users')} />
            <ListRow icon="chatbubbles-outline" iconTint={colors.info} title="Customer requests" subtitle="Visits customers asked for" onPress={() => router.push('/admin/requests')} />
            <ListRow icon="shirt-outline" iconTint={colors.accent} title="Dress-code reviews" subtitle="Approve check-in photos" onPress={() => router.push('/admin/reviews')} />
            <ListRow icon="calendar-outline" iconTint={colors.info} title="Attendance register" subtitle="Check-in/out times, photos and absentees" onPress={() => router.push('/admin/attendance')} />
          </>
        ) : null}
        <ListRow icon="download-outline" iconTint={colors.success} title="Reports & exports" subtitle="Attendance, jobs and reconciliation as Excel" onPress={() => router.push('/admin/reports')} />
        <ListRow icon="notifications-outline" iconTint={colors.primary} title="Notifications" subtitle="Alerts and activity" onPress={() => router.push('/notifications')} />
        <ListRow icon="git-compare-outline" title="Stock reconciliation" subtitle="Issued vs. installed vs. in hand, per technician" onPress={() => router.push('/admin/reconciliation')} />
        <ListRow icon="list-outline" iconTint={colors.warning} title="Stock ledger" subtitle="Every movement, newest first" onPress={() => router.push('/admin/movements')} />
        <ListRow icon="pricetags-outline" iconTint={colors.text} title="Catalogue" subtitle="Items, prices, reorder levels, adjustments" onPress={() => router.push('/admin/items')} />
        <ListRow icon="search" iconTint={colors.text} title="Search" subtitle="Jobs, devices, people and requests" onPress={() => router.push('/search')} />
        {role === 'ADMIN' ? <ListRow icon="shield-checkmark-outline" iconTint={colors.text} title="Audit log" subtitle="Who changed what, and when" onPress={() => router.push('/admin/audit')} /> : null}
        <ListRow icon="key-outline" iconTint={colors.text} title="Change password" onPress={() => router.push('/change-password')} />
        <ListRow icon="search-outline" iconTint={colors.info} title="Trace a device" subtitle="Full chain of custody by serial number" onPress={() => router.push('/admin/unit')} />
      </ProfileView>
    </Screen>
  );
}
