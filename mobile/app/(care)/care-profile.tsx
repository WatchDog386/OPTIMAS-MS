import { router } from 'expo-router';
import { SmeProfilePage } from '../../src/components/SmeProfile';
import { useApi } from '../../src/hooks/useApi';

/** Customer care's profile: the Optimas-SME profile page. */
export default function CareProfile() {
  const unread = useApi<{ unread: number }>('/notifications/unread-count');
  return (
    <SmeProfilePage
      tools={[
        { key: 'alerts', icon: 'notifications-outline', title: 'Notifications', sub: 'Alerts and activity', onPress: () => router.push('/notifications'), count: unread.data?.unread },
        { key: 'search', icon: 'search', title: 'Search', sub: 'Jobs and customers', onPress: () => router.push('/search') },
      ]}
    />
  );
}
