import { useCallback, useEffect, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { router, Stack } from 'expo-router';
import { Platform, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../src/components/Button';
import { Text } from '../src/components/Text';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  Figtree_400Regular,
  Figtree_500Medium,
  Figtree_600SemiBold,
  Figtree_700Bold,
  Figtree_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/figtree';
import { useAuth } from '../src/store/auth';
import { registerForPush } from '../src/utils/push';
import { openNotificationTarget } from '../src/utils/notifications';
import { setupPwa } from '../src/utils/install';
import { InstallPrompt } from '../src/components/InstallPrompt';
import { Splash } from '../src/components/Splash';
import { UpdateBanner } from '../src/components/UpdateBanner';
import { NotificationWatcher } from '../src/components/NotificationWatcher';
import { FeedbackHost } from '../src/components/FeedbackHost';
import { RouteLoader } from '../src/components/RouteLoader';
import { unlockAudioOnFirstTouch } from '../src/utils/chime';
import { colors } from '../src/theme';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

/** Shown instead of a white screen if any page crashes. */
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => Promise<void> }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 14, backgroundColor: colors.bgTop }}>
      <Ionicons name="warning-outline" size={44} color={colors.text} />
      <Text variant="h2" align="center">
        Something went wrong on this screen
      </Text>
      <Text variant="bodySm" color={colors.textMuted} align="center">
        {error.message}
      </Text>
      <Button label="Try again" icon="refresh" onPress={() => void retry()} />
      <Button label="Go to home" variant="ghost" onPress={() => router.replace('/')} />
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Figtree_400Regular,
    Figtree_500Medium,
    Figtree_600SemiBold,
    Figtree_700Bold,
    Figtree_800ExtraBold,
  });
  const hydrated = useAuth((s) => s.hydrated);
  const [splashDone, setSplashDone] = useState(false);
  const hideSplash = useCallback(() => setSplashDone(true), []);
  const ready = fontsLoaded && hydrated;
  const userId = useAuth((s) => s.user?.id);

  useEffect(() => {
    void useAuth.getState().hydrate();
    setupPwa();
    unlockAudioOnFirstTouch();
  }, []);

  // Register this device for push once someone is signed in.
  useEffect(() => {
    if (userId) void registerForPush();
  }, [userId]);

  // Tapping a push notification opens the related screen.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const content = response.notification.request.content;
      const data = (content.data ?? {}) as Record<string, unknown>;
      openNotificationTarget(String(data.type ?? ''), data);
    });
    return () => sub.remove();
  }, []);

  // Hand over from the native splash to the in-app one as soon as the fonts are in.
  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => undefined);
  }, [fontsLoaded]);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {ready ? <AppStack /> : null}
      {splashDone ? null : <Splash fontsReady={fontsLoaded} ready={ready} onDone={hideSplash} />}
    </SafeAreaProvider>
  );
}

function AppStack() {
  return (
    <>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'slide_from_right' }}>
        <Stack.Screen name="capture" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
        <Stack.Screen name="scan" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
      </Stack>
      <RouteLoader />
      <InstallPrompt />
      <UpdateBanner />
      <NotificationWatcher />
      <FeedbackHost />
    </>
  );
}
