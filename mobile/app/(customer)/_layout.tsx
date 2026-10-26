import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { FloatingTabBar, tabIcon, tabScreenOptions } from '../../src/components/tabs';
import { homeFor, useAuth } from '../../src/store/auth';

export default function CustomerLayout() {
  const user = useAuth((s) => s.user);
  if (!user) return <Redirect href="/login" />;
  if (user.mustChangePassword) return <Redirect href="/change-password?forced=1" />;
  if (user.role !== 'CUSTOMER') return <Redirect href={homeFor(user.role)} />;
  return (
    <Tabs screenOptions={tabScreenOptions} tabBar={(props) => <FloatingTabBar {...props} />}>
      <Tabs.Screen name="portal" options={{ title: 'Home', tabBarIcon: tabIcon('home-outline', 'home') }} />
      <Tabs.Screen name="requests" options={{ title: 'Requests', tabBarIcon: tabIcon('chatbubbles-outline', 'chatbubbles') }} />
      <Tabs.Screen name="account" options={{ title: 'Account', tabBarIcon: tabIcon('person-outline', 'person') }} />
    </Tabs>
  );
}
