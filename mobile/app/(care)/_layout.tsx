import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { FloatingTabBar, tabIcon, tabScreenOptions } from '../../src/components/tabs';
import { homeFor, useAuth } from '../../src/store/auth';

// Home sits in the middle of the bar and stays the tab the app opens on
export const unstable_settings = { initialRouteName: 'care' };

/** Customer care: support chats, customer requests, customer logins, and following jobs. */
export default function CareLayout() {
  const user = useAuth((s) => s.user);
  if (!user) return <Redirect href="/login" />;
  if (user.mustChangePassword) return <Redirect href="/change-password?forced=1" />;
  if (user.role !== 'CUSTOMER_CARE') return <Redirect href={homeFor(user.role) as never} />;
  return (
    <Tabs screenOptions={tabScreenOptions} tabBar={(props) => <FloatingTabBar {...props} />}>
      <Tabs.Screen name="support" options={{ title: 'Chats', tabBarIcon: tabIcon('chatbubble-ellipses-outline', 'chatbubble-ellipses') }} />
      <Tabs.Screen name="care-requests" options={{ title: 'Requests', tabBarIcon: tabIcon('megaphone-outline', 'megaphone') }} />
      <Tabs.Screen name="care" options={{ title: 'Home', tabBarIcon: tabIcon('headset-outline', 'headset') }} />
      <Tabs.Screen name="care-jobs" options={{ title: 'Jobs', tabBarIcon: tabIcon('briefcase-outline', 'briefcase') }} />
      <Tabs.Screen name="care-profile" options={{ title: 'Profile', tabBarIcon: tabIcon('person-outline', 'person') }} />
    </Tabs>
  );
}
