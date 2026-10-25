import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { tabIcon, tabScreenOptions } from '../../src/components/tabs';
import { isManager, useAuth } from '../../src/store/auth';

export default function AdminLayout() {
  const user = useAuth((s) => s.user);
  if (!user) return <Redirect href="/login" />;
  if (!isManager(user.role)) return <Redirect href="/home" />;
  const storeOnly = user.role === 'STOREKEEPER';
  return (
    <Tabs screenOptions={tabScreenOptions}>
      <Tabs.Screen name="overview" options={{ title: 'Overview', tabBarIcon: tabIcon('grid-outline', 'grid') }} />
      <Tabs.Screen name="team" options={{ title: 'Team', tabBarIcon: tabIcon('people-outline', 'people'), href: storeOnly ? null : undefined }} />
      <Tabs.Screen name="board" options={{ title: 'Jobs', tabBarIcon: tabIcon('briefcase-outline', 'briefcase') }} />
      <Tabs.Screen name="store" options={{ title: 'Store', tabBarIcon: tabIcon('cube-outline', 'cube') }} />
      <Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: tabIcon('ellipsis-horizontal-circle-outline', 'ellipsis-horizontal-circle') }} />
    </Tabs>
  );
}
