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
} from '@expo-google-fonts/figtree';
import * as Font from 'expo-font';
import { Asset } from 'expo-asset';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold } from '@expo-google-fonts/inter';
import { OPENED_ON_DESKTOP } from '../src/theme/desktop';
import { DesktopShell } from '../src/components/desktop/DesktopShell';
import { useAuth } from '../src/store/auth';
import { registerForPush } from '../src/utils/push';
import { openNotificationTarget } from '../src/utils/notifications';
import { setupPwa } from '../src/utils/install';
import { InstallPrompt } from '../src/components/InstallPrompt';
import { Splash } from '../src/components/Splash';
import { UpdateBanner } from '../src/components/UpdateBanner';
import { NotificationWatcher } from '../src/components/NotificationWatcher';
import { SyncStatus } from '../src/components/SyncStatus';
import { PhotoViewerHost } from '../src/components/PhotoViewer';
import { startSyncLoop } from '../src/offline/queue';
import { prefetchWork } from '../src/offline/prefetch';
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

const FIGTREE = { Figtree_400Regular, Figtree_500Medium, Figtree_600SemiBold, Figtree_700Bold, Figtree_800ExtraBold };
// Inter under the same names, so every screen picks it up on a desktop browser (like the Business-SME app)
const INTER = { Figtree_400Regular: Inter_400Regular, Figtree_500Medium: Inter_500Medium, Figtree_600SemiBold: Inter_600SemiBold, Figtree_700Bold: Inter_700Bold, Figtree_800ExtraBold: Inter_800ExtraBold };

/**
 * Figtree on phones, Inter on a laptop or desktop. A font that fails to download (a damaged or cut-off
 * file) never keeps the app from opening: Inter falls back to Figtree, and after a few seconds the app
 * opens anyway with the browser's own font.
 */
/** Inter would not load: put Figtree under the same names (added last, so it is the face the page uses). */
async function figtreeInstead() {
  if (typeof document === 'undefined' || typeof FontFace === 'undefined') return;
  await Promise.all(
    Object.entries(FIGTREE).map(async ([name, mod]) => {
      const face = new FontFace(name, `url(${Asset.fromModule(mod).uri})`);
      await face.load();
      (document.fonts as unknown as { add: (f: FontFace) => void }).add(face);
    }),
  );
}

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
    (OPENED_ON_DESKTOP ? Font.loadAsync(INTER).catch(figtreeInstead) : Font.loadAsync(FIGTREE))
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

  // Send anything saved offline whenever there is a signal
  useEffect(() => startSyncLoop(), []);

  useEffect(() => {
    void useAuth.getState().hydrate();
    setupPwa();
    unlockAudioOnFirstTouch();
  }, []);

  // Register this device for push once someone is signed in.
  useEffect(() => {
    if (userId) void registerForPush();
  }, [userId]);

  // Keep a technician's jobs and stock on the phone as soon as they are known
  useEffect(() => {
    if (userId) void prefetchWork();
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
      <SyncStatus />
      <PhotoViewerHost />
      <LocationHost />
      <PageLoader />
      <LockHost />
      <FeedbackHost />
    </>
  );
}

