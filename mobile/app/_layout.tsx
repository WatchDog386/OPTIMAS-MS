import { useCallback, useEffect, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { router, Stack } from 'expo-router';
import { Platform, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Button } from '../src/components/Button';
import { Text } from '../src/components/Text';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Font from 'expo-font';
import { DesktopShell } from '../src/components/desktop/DesktopShell';
import { OfflineBar, clearOfflineLeftovers } from '../src/components/OfflineBar';
import { useAuth } from '../src/store/auth';
import { registerForPush } from '../src/utils/push';
import { openNotificationTarget } from '../src/utils/notifications';
import { setupPwa } from '../src/utils/install';
import { InstallPrompt } from '../src/components/InstallPrompt';
import { Splash } from '../src/components/Splash';
import { UpdateBanner } from '../src/components/UpdateBanner';
import { NotificationWatcher } from '../src/components/NotificationWatcher';
import { PhotoViewerHost } from '../src/components/PhotoViewer';
import { FeedbackHost } from '../src/components/FeedbackHost';
import { LocationHost } from '../src/components/LocationHost';
import { LockHost } from '../src/components/LockHost';
import { BackGuard } from '../src/components/BackGuard';
import { PageLoader } from '../src/components/PageLoader';
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

// Open Sans, as in the Co-op app: small web font files (about 18 KB each, Latin letters only)
const OPEN_SANS = {
  OpenSans_400Regular: require('@fontsource/open-sans/files/open-sans-latin-400-normal.woff2'),
  OpenSans_500Medium: require('@fontsource/open-sans/files/open-sans-latin-500-normal.woff2'),
  OpenSans_600SemiBold: require('@fontsource/open-sans/files/open-sans-latin-600-normal.woff2'),
  OpenSans_700Bold: require('@fontsource/open-sans/files/open-sans-latin-700-normal.woff2'),
  OpenSans_800ExtraBold: require('@fontsource/open-sans/files/open-sans-latin-800-normal.woff2'),
  // Only the icons the app uses (48 KB instead of the full 390 KB set), under the name the icons look for,
  // so the full set is never downloaded. Rebuild with scripts/icons-subset.py after using a new icon.
  ionicons: require('../assets/fonts/ionicons-app.woff2'),
};

/**
 * Open Sans everywhere. A font that fails to download never keeps the app from opening: after a few
 * seconds it opens anyway with the browser's own font.
 */
function useAppFonts() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let done = false;
    const finish = () => {
      if (!done) {
        done = true;
        setReady(true);
      }
    };
    const giveUp = setTimeout(finish, 6000);
    Font.loadAsync(OPEN_SANS)
      .catch(() => undefined)
      .finally(finish);
    return () => clearTimeout(giveUp);
  }, []);
  return ready;
}

export default function RootLayout() {
  const fontsLoaded = useAppFonts();
  const hydrated = useAuth((s) => s.hydrated);
  const [splashDone, setSplashDone] = useState(false);
  const hideSplash = useCallback(() => setSplashDone(true), []);
  const ready = fontsLoaded && hydrated;
  const userId = useAuth((s) => s.user?.id);

  // Online only: clear what older versions of the app kept on the phone for offline use
  useEffect(() => clearOfflineLeftovers(), []);

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
      <DesktopShell>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'slide_from_right' }}>
          <Stack.Screen name="capture" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
          <Stack.Screen name="scan" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
        </Stack>
      </DesktopShell>
      <RouteLoader />
      <BackGuard />
      <InstallPrompt />
      <UpdateBanner />
      <NotificationWatcher />
      <OfflineBar />
      <PhotoViewerHost />
      <LocationHost />
      <PageLoader />
      <LockHost />
      <FeedbackHost />
    </>
  );
}

