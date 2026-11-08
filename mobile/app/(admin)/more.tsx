import { router } from 'expo-router';
import { SmeProfilePage, type ProfileTool } from '../../src/components/SmeProfile';
import { useApi } from '../../src/hooks/useApi';
import { useAuth } from '../../src/store/auth';

/** Profile (office staff): the Optimas-SME profile page with this role's tools. */
export default function More() {
  const role = useAuth((s) => s.user?.role);
  const unread = useApi<{ unread: number }>('/notifications/unread-count');
  const managers = role === 'ADMIN' || role === 'SUPERVISOR';
  const go = (href: string) => () => router.push(href as never);
  const tools: ProfileTool[] = [
    { key: 'alerts', icon: 'notifications-outline', title: 'Notifications', sub: 'Alerts and activity', onPress: go('/notifications'), count: unread.data?.unread },
    { key: 'trace', icon: 'barcode-outline', title: 'Trace a device', sub: 'Custody by serial number', onPress: go('/admin/unit') },
    ...(managers ? [{ key: 'office', icon: 'business-outline' as const, title: 'Office location', sub: 'Where staff check in', onPress: go('/admin/office') }] : []),
    ...(role === 'ADMIN' ? [{ key: 'audit', icon: 'list-outline' as const, title: 'Audit log', sub: 'Who changed what', onPress: go('/admin/audit') }] : []),
  ];
  return <SmeProfilePage tools={tools} />;
}
