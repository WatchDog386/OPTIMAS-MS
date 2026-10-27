import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { FloatingTabBar, tabIcon, tabScreenOptions } from '../../src/components/tabs';
import { useAuth } from '../../src/store/auth';

// Home sits in the middle of the bar and stays the tab the app opens on
export const unstable_settings = { initialRouteName: 'home' };

export default function TechLayout() {
  const user = useAuth((s) => s.user);
  if (!user) return <Redirect href="/login" />;
  if (user.mustChangePassword) return <Redirect href="/change-password?forced=1" />;
  if (user.role === 'CUSTOMER') return <Redirect href="/portal" />;
  return (
    <Tabs screenOptions={tabScreenOptions} tabBar={(props) => <FloatingTabBar {...props} />}>
      <Tabs.Screen name="jobs" options={{ title: 'Jobs', tabBarIcon: tabIcon('briefcase-outline', 'briefcase') }} />
      <Tabs.Screen name="stock" options={{ title: 'My stock', tabBarIcon: tabIcon('cube-outline', 'cube') }} />
      <Tabs.Screen name="home" options={{ title: 'Home', tabBarIcon: tabIcon('flash-outline', 'flash') }} />
      <Tabs.Screen name="messages" options={{ title: 'Chats', tabBarIcon: tabIcon('chatbubble-ellipses-outline', 'chatbubble-ellipses') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: tabIcon('person-outline', 'person') }} />
    </Tabs>
  );
}
