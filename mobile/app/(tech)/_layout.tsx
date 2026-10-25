import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { tabIcon, tabScreenOptions } from '../../src/components/tabs';
import { useAuth } from '../../src/store/auth';

export default function TechLayout() {
  const user = useAuth((s) => s.user);
  if (!user) return <Redirect href="/login" />;
  return (
    <Tabs screenOptions={tabScreenOptions}>
      <Tabs.Screen name="home" options={{ title: 'Home', tabBarIcon: tabIcon('flash-outline', 'flash') }} />
      <Tabs.Screen name="jobs" options={{ title: 'Jobs', tabBarIcon: tabIcon('briefcase-outline', 'briefcase') }} />
      <Tabs.Screen name="stock" options={{ title: 'My stock', tabBarIcon: tabIcon('cube-outline', 'cube') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: tabIcon('person-outline', 'person') }} />
    </Tabs>
  );
}
