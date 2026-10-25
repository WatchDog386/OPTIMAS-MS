import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { api } from '../api/client';
import { colors } from '../theme';

let registeredToken: string | null = null;

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: true }),
});

/**
 * Asks for notification permission, obtains this device's Expo push token and registers it with the API.
 * Silently does nothing on simulators, web, or when the user declines — the in-app inbox still works.
 */
export async function registerForPush() {
  try {
    if (Platform.OS === 'web' || !Device.isDevice) return;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Optimas MS',
        importance: Notifications.AndroidImportance.HIGH,
        lightColor: colors.primary,
        vibrationPattern: [0, 200, 120, 200],
      });
    }
    const current = await Notifications.getPermissionsAsync();
    const status = current.granted ? current : await Notifications.requestPermissionsAsync();
    if (!status.granted) return;

    const projectId = (Constants.expoConfig?.extra?.eas?.projectId as string | undefined) ?? Constants.easConfig?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    await api('/notifications/push-token', { body: { token, platform: Platform.OS } });
    registeredToken = token;
  } catch (err) {
    console.warn('Push registration skipped:', err);
  }
}

/** Detach this device from the signed-in user (call before logging out). */
export async function unregisterPush() {
  if (!registeredToken) return;
  try {
    await api('/notifications/push-token', { method: 'DELETE', body: { token: registeredToken } });
  } catch {
    /* best effort */
  } finally {
    registeredToken = null;
  }
}
