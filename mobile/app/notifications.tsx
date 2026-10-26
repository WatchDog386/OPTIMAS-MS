import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../src/api/client';
import { Button, EmptyState, Glass, Screen, ScreenHeader, Text } from '../src/components';
import { enableWebPush, webPushState, type WebPushState } from '../src/utils/webpush';
import { toast } from '../src/store/feedback';
import { useApi } from '../src/hooks/useApi';
import { colors, radius, space } from '../src/theme';
import { ago, notificationStyle, openNotificationTarget, type AppNotification } from '../src/utils/notifications';

export default function Notifications() {
  const { data, refresh, refreshing, loading } = useApi<{ notifications: AppNotification[]; unread: number }>('/notifications');

  // On the installed web app: offer alerts that arrive even when the app is closed
  const [push, setPush] = useState<WebPushState>('unsupported');
  useEffect(() => {
    void webPushState().then(setPush);
  }, []);
  const turnOn = async () => {
    try {
      const result = await enableWebPush();
      setPush(result);
      if (result === 'granted') toast.success('Alerts are on', 'You will be notified even when the app is closed.');
      else if (result === 'denied') toast.warning('Alerts blocked', 'Allow notifications for this site in your browser settings to turn them on.');
    } catch {
      toast.error('Could not turn alerts on', 'Check your connection and try again.');
    }
  };

  // Opening the inbox marks everything as read (the list keeps showing which ones were new).
  useEffect(() => {
    if (data?.unread) void api('/notifications/read', { body: {} }).catch(() => undefined);
  }, [data?.unread]);

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <ScreenHeader title="Notifications" subtitle={data?.unread ? `${data.unread} new` : 'You are all caught up'} />
      {push === 'default' ? (
        <Glass strong style={{ gap: space.md }}>
          <Text variant="title">Get alerts when the app is closed</Text>
          <Text variant="bodySm" color={colors.textMuted}>
            Job assignments, approvals and stock alerts will appear on this phone like any other app.
          </Text>
          <Button label="Turn on alerts" icon="notifications" onPress={turnOn} />
        </Glass>
      ) : null}
      {!loading && !data?.notifications.length ? (
        <EmptyState icon="notifications-off-outline" title="No notifications yet" message="Job assignments, stock and approvals will show up here." />
      ) : null}
      {data?.notifications.map((n) => {
        const style = notificationStyle[n.type] ?? { icon: 'notifications' as const, tint: colors.primary };
        return (
          <Pressable key={n.id} onPress={() => openNotificationTarget(n.type, n.data)} style={({ pressed }) => [styles.row, !n.readAt && styles.unread, pressed && { opacity: 0.8 }]}>
            <View style={[styles.icon, { backgroundColor: `${style.tint}22` }]}>
              <Ionicons name={style.icon} size={20} color={style.tint} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="title">{n.title}</Text>
              <Text variant="bodySm" color={colors.textMuted}>
                {n.body}
              </Text>
              <Text variant="label" color={colors.textDim}>
                {ago(n.createdAt)}
              </Text>
            </View>
            {!n.readAt ? <View style={styles.dot} /> : null}
          </Pressable>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.md, padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  unread: { backgroundColor: colors.primarySoft, borderColor: colors.primarySoft },
  icon: { width: 42, height: 42, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary, marginTop: 6 },
});
