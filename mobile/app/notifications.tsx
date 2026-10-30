import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../src/api/client';
import { Button, EmptyState, Glass, PageHeader, Reveal, Screen, Text } from '../src/components';
import { enableWebPush, webPushState, type WebPushState } from '../src/utils/webpush';
import { toast } from '../src/store/feedback';
import { useApi } from '../src/hooks/useApi';
import { colors, fonts, space } from '../src/theme';
import { notificationStyle, openNotificationTarget, type AppNotification } from '../src/utils/notifications';

type Tab = 'ALL' | 'JOBS' | 'ATTENDANCE' | 'STOCK';
const TAB_OF: Record<string, Exclude<Tab, 'ALL'>> = {
  TASK_ASSIGNED: 'JOBS',
  TASK_COMPLETED: 'JOBS',
  TASK_VERIFIED: 'JOBS',
  TASK_REJECTED: 'JOBS',
  TASK_CANCELLED: 'JOBS',
  JOB_UPDATE: 'JOBS',
  SERVICE_REQUEST: 'JOBS',
  DRESS_REJECTED: 'ATTENDANCE',
  CHECKOUT_REJECTED: 'ATTENDANCE',
  LATE_CHECK_IN: 'ATTENDANCE',
  PHOTO_FLAGGED: 'ATTENDANCE',
  STOCK_ISSUED: 'STOCK',
  STOCK_COUNT_MISMATCH: 'STOCK',
  UNIT_LOST: 'STOCK',
};
const TAB_LABEL: Record<Tab, string> = { ALL: 'All', JOBS: 'Jobs', ATTENDANCE: 'Attendance', STOCK: 'Stock' };

/** "12:32 PM" today, otherwise "23/10/26". */
function when(iso: string) {
  const d = new Date(iso);
  const day = (x: Date) => x.toLocaleDateString('en-GB', { timeZone: 'Africa/Nairobi' });
  if (day(d) === day(new Date())) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Nairobi' });
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'Africa/Nairobi' });
}

/** Inbox: filter tabs, unread dots, "Mark all as Read"; opening one marks it read and goes to what it is about. */
export default function Notifications() {
  const { data, setData, refresh, refreshing, loading } = useApi<{ notifications: AppNotification[]; unread: number }>('/notifications');
  const [tab, setTab] = useState<Tab>('ALL');

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

  const all = useMemo(() => data?.notifications ?? [], [data]);
  // Only the tabs that have something in them
  const tabs = useMemo(() => (['ALL', 'JOBS', 'ATTENDANCE', 'STOCK'] as Tab[]).filter((t) => t === 'ALL' || all.some((n) => TAB_OF[n.type] === t)), [all]);
  const shown = tab === 'ALL' ? all : all.filter((n) => TAB_OF[n.type] === tab);
  const unreadIn = (t: Tab) => (t === 'ALL' ? all : all.filter((n) => TAB_OF[n.type] === t)).filter((n) => !n.readAt).length;

  const markRead = (ids?: string[]) => {
    const now = new Date().toISOString();
    setData((prev) =>
      prev ? { unread: ids ? Math.max(0, prev.unread - ids.length) : 0, notifications: prev.notifications.map((n) => (!n.readAt && (!ids || ids.includes(n.id)) ? { ...n, readAt: now } : n)) } : prev,
    );
    void api('/notifications/read', { body: ids ? { ids } : {} }).catch(() => undefined);
  };
  const open = (n: AppNotification) => {
    if (!n.readAt) markRead([n.id]);
    openNotificationTarget(n.type, n.data);
  };

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <PageHeader
        title="Notifications"
        right={
          <Pressable onPress={() => markRead()} disabled={!data?.unread} hitSlop={8} accessibilityRole="button" style={{ opacity: data?.unread ? 1 : 0.4 }}>
            <Text variant="bodySm" color={colors.brand} style={{ fontFamily: fonts.semibold }}>
              Mark all as Read
            </Text>
          </Pressable>
        }
      />

      {tabs.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {tabs.map((t) => {
            const on = t === tab;
            const n = unreadIn(t);
            return (
              <Pressable key={t} onPress={() => setTab(t)} accessibilityRole="tab" accessibilityState={{ selected: on }} style={({ pressed }) => [styles.tab, on && styles.tabOn, pressed && { opacity: 0.8 }]}>
                <Text variant="bodySm" color={on ? colors.white : colors.text} fixedColor={on} style={{ fontFamily: on ? fonts.semibold : fonts.medium }}>
                  {TAB_LABEL[t]}
                  {n ? ` · ${n}` : ''}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      {push === 'default' ? (
        <Glass strong style={{ gap: space.md }}>
          <Text variant="title">Get alerts when the app is closed</Text>
          <Text variant="bodySm" color={colors.textMuted}>
            Job assignments, approvals and stock alerts will appear on this phone like any other app.
          </Text>
          <Button label="Turn on alerts" icon="notifications" onPress={turnOn} />
        </Glass>
      ) : null}

      {!loading && !shown.length ? <EmptyState icon="notifications-off-outline" title={all.length ? 'Nothing here' : 'No notifications yet'} message="Job assignments, stock and approvals will show up here." /> : null}
      <View style={{ gap: 12 }}>
        {shown.map((n, idx) => {
          const style = notificationStyle[n.type] ?? { icon: 'notifications' as const, tint: colors.primary };
          return (
            <Reveal key={n.id} index={Math.min(idx, 8)}>
              <Pressable onPress={() => open(n)} accessibilityRole="button" accessibilityLabel={`${n.readAt ? '' : 'New. '}${n.title}. ${n.body}`} style={({ pressed }) => [styles.card, pressed && { opacity: 0.75, transform: [{ scale: 0.99 }] }]}>
                {!n.readAt ? <View style={styles.dot} /> : null}
                <View style={styles.icon}>
                  <Ionicons name={style.icon} size={22} color={style.tint} />
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <View style={styles.titleRow}>
                    <Text variant="title" numberOfLines={1} style={{ flex: 1, fontFamily: n.readAt ? fonts.medium : fonts.semibold }}>
                      {n.title}
                    </Text>
                    <Text variant="label" color={colors.textMuted}>
                      {when(n.createdAt)}
                    </Text>
                  </View>
                  <Text variant="bodySm" color={colors.textMuted} numberOfLines={3}>
                    {n.body}
                  </Text>
                </View>
              </Pressable>
            </Reveal>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: { gap: 10, paddingVertical: 2 },
  tab: { height: 44, paddingHorizontal: 22, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.glassStrong, borderWidth: 1, borderColor: colors.glassBorder },
  tabOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 18, paddingHorizontal: 16, paddingLeft: 22, borderRadius: 16, backgroundColor: colors.glassStrong, borderWidth: 1, borderColor: colors.glassBorder },
  dot: { position: 'absolute', left: 9, top: 14, width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brand },
  icon: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
