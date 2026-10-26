import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/client';
import { useAuth } from '../store/auth';
import { colors, fonts } from '../theme';
import * as Notifications from 'expo-notifications';
import { playChime } from '../utils/chime';
import { hasPush } from '../utils/push';
import { notificationStyle, openNotificationTarget, type AppNotification } from '../utils/notifications';
import { Text } from './Text';

const POLL_MS = 20_000;
const SHOW_MS = 6_000;

/**
 * While someone is signed in, watches the unread count. When it goes up, plays the chime and drops in a
 * banner with the newest notification (tap to open it). Push notifications cover the phone's lock screen;
 * this covers the open app, including the installed web app which has no push.
 */
export function NotificationWatcher() {
  const userId = useAuth((s) => s.user?.id);
  const insets = useSafeAreaInsets();
  const [latest, setLatest] = useState<AppNotification | null>(null);
  const last = useRef<number | null>(null);
  const y = useRef(new Animated.Value(-160)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    last.current = null;
    if (!userId) return;
    let stopped = false;
    const check = async () => {
      try {
        const { unread } = await api<{ unread: number }>('/notifications/unread-count');
        if (stopped) return;
        const before = last.current;
        last.current = unread;
        if (before === null || unread <= before) return; // first reading, or nothing new
        const { notifications } = await api<{ notifications: AppNotification[] }>('/notifications');
        if (stopped || !notifications[0]) return;
        setLatest(notifications[0]);
        if (Platform.OS === 'web') playChime();
        // Android/iOS app without push (no FCM set up): raise a local notification so the phone
        // plays its own sound and vibrates. With push active the system already did.
        else if (!hasPush()) {
          void Notifications.scheduleNotificationAsync({ content: { title: notifications[0].title, body: notifications[0].body, sound: 'default' }, trigger: null }).catch(() => undefined);
        }
      } catch {
        // offline or signed out — try again next tick
      }
    };
    void check();
    const t = setInterval(check, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(t);
    };
  }, [userId]);

  useEffect(() => {
    if (!latest) return;
    Animated.timing(y, { toValue: 0, duration: 420, easing: Easing.bezier(0.2, 0.8, 0.2, 1), useNativeDriver: Platform.OS !== 'web' }).start();
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(hide, SHOW_MS);
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latest]);

  const hide = () => Animated.timing(y, { toValue: -160, duration: 300, useNativeDriver: Platform.OS !== 'web' }).start(() => setLatest(null));

  if (!latest || !userId) return null;
  const style = notificationStyle[latest.type] ?? { icon: 'notifications' as const, tint: colors.text };
  return (
    <Animated.View pointerEvents="box-none" style={[styles.wrap, { top: insets.top + 10, transform: [{ translateY: y }] }]}>
      <Pressable
        onPress={() => {
          hide();
          openNotificationTarget(latest.type, latest.data);
        }}
        accessibilityRole="alert"
        style={({ pressed }) => [styles.card, pressed && { transform: [{ scale: 0.98 }] }]}
      >
        <View style={styles.icon}>
          <Ionicons name={style.icon} size={18} color={colors.onHighlight} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="title" color={colors.white} fixedColor numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 14 }}>
            {latest.title}
          </Text>
          <Text variant="label" color="rgba(255,255,255,0.7)" fixedColor numberOfLines={2}>
            {latest.body}
          </Text>
        </View>
        <Pressable onPress={hide} hitSlop={10} accessibilityLabel="Dismiss">
          <Ionicons name="close" size={18} color="rgba(255,255,255,0.6)" />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 14, right: 14, zIndex: 60, alignItems: 'center' },
  card: {
    width: '100%',
    maxWidth: 460,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 22,
    backgroundColor: colors.charcoal,
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  icon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.highlight, alignItems: 'center', justifyContent: 'center' },
});
