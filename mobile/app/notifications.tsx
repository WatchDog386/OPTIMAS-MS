import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../src/api/client';
import { Button, Reveal, Text } from '../src/components';
import { SME, SmeAppBar, useScrolledBar, SmeChips } from '../src/components/SmeKit';
import { enableWebPush, webPushState, type WebPushState } from '../src/utils/webpush';
import { alertDialog, toast } from '../src/store/feedback';
import { useLocalSearchParams } from 'expo-router';
import { useApi } from '../src/hooks/useApi';
import { RoleTabBar } from '../src/components/tabs';
import { fonts, isDark, space } from '../src/theme';
import { notificationLook, openNotificationTarget, type AppNotification, type NoteTone } from '../src/utils/notifications';

type Tab = 'ALL' | 'JOBS' | 'ATTENDANCE' | 'STOCK' | 'ACTIVITY';
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
  STOCK_APPROVAL: 'STOCK',
  DAY_REPORT: 'JOBS',
  // Everything people do in the app (admins and supervisors)
  ACTIVITY: 'ACTIVITY',
};

/** SME's coloured round icon tiles: a soft tint with the icon in the strong colour. */
const TONE: Record<NoteTone, { bg: string; fg: string }> = isDark
  ? {
      warning: { bg: 'rgba(245,158,11,0.12)', fg: '#FCD34D' },
      danger: { bg: 'rgba(239,68,68,0.12)', fg: '#FCA5A5' },
      info: { bg: 'rgba(14,165,233,0.12)', fg: '#7DD3FC' },
      success: { bg: 'rgba(16,185,129,0.12)', fg: '#6EE7B7' },
      chat: { bg: 'rgba(139,92,246,0.14)', fg: '#C4B5FD' },
      neutral: { bg: 'rgba(255,255,255,0.08)', fg: '#D4D4D8' },
    }
  : {
      warning: { bg: '#FFF4D6', fg: '#B45309' },
      danger: { bg: '#FDE4E4', fg: '#C62828' },
      info: { bg: '#E0F0FB', fg: '#0369A1' },
      success: { bg: '#DDF3E8', fg: '#047857' },
      chat: { bg: '#ECE6FB', fg: '#6D28D9' },
      neutral: { bg: '#F1F3F2', fg: '#52525B' },
    };
const TAB_LABEL: Record<Tab, string> = { ALL: 'All', JOBS: 'Tasks', ATTENDANCE: 'Attendance', STOCK: 'Stock', ACTIVITY: 'Activity' };

/** "12:32 PM" today, otherwise "23/10/26". */
function when(iso: string) {
  const d = new Date(iso);
  const day = (x: Date) => x.toLocaleDateString('en-GB', { timeZone: 'Africa/Nairobi' });
  if (day(d) === day(new Date())) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Nairobi' });
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'Africa/Nairobi' });
}

/**
 * Notifications, as in Optimas-SME: "Mark all read", filled topic tabs, then what is still unread (read
 * ones leave the list; "Show read" brings them back). Each
 * is a clear card with a coloured round icon (a red dot while unread, green once read); opening one marks it read and goes to what it is about.
 */
export default function Notifications() {
  const insets = useSafeAreaInsets();
  const bar = useScrolledBar();
  const { data, setData, loading } = useApi<{ notifications: AppNotification[]; unread: number }>('/notifications');
  const [tab, setTab] = useState<Tab>('ALL');
  // Read notifications leave the list; they can still be looked at here
  const [showRead, setShowRead] = useState(false);

  // Opened from a phone alert: open what it is about straight away
  const { go } = useLocalSearchParams<{ go?: string }>();
  useEffect(() => {
    if (!go) return;
    try {
      const { type, data: d } = JSON.parse(go) as { type: string; data: Record<string, unknown> };
      openNotificationTarget(type, d);
    } catch {
      /* not a link from an alert */
    }
  }, [go]);

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
  // Tabs: All, then only the topics that have something
  const tabs = useMemo(() => (['ALL', 'ACTIVITY', 'JOBS', 'ATTENDANCE', 'STOCK'] as Tab[]).filter((t) => t === 'ALL' || all.some((n) => TAB_OF[n.type] === t)), [all]);
  const shown = tab === 'ALL' ? all : all.filter((n) => TAB_OF[n.type] === tab);
  const unreadIn = (t: Tab) => (t === 'ALL' ? all : all.filter((n) => TAB_OF[n.type] === t)).filter((n) => !n.readAt).length;
  const fresh = shown.filter((n) => !n.readAt);
  const earlier = shown.filter((n) => n.readAt);

  const markRead = (ids?: string[]) => {
    const now = new Date().toISOString();
    setData((prev) =>
      prev ? { unread: ids ? Math.max(0, prev.unread - ids.length) : 0, notifications: prev.notifications.map((n) => (!n.readAt && (!ids || ids.includes(n.id)) ? { ...n, readAt: now } : n)) } : prev,
    );
    void api('/notifications/read', { body: ids ? { ids } : {} }).catch(() => undefined);
  };
  // Opening one marks it read (so it leaves the list) and goes to what it is about; one with no page of
  // its own opens in full here
  const open = (n: AppNotification) => {
    if (!n.readAt) markRead([n.id]);
    if (!openNotificationTarget(n.type, n.data)) void alertDialog({ title: n.title, message: n.body, emoji: '🔔' });
  };

  return (
    <View style={styles.root}>
      <SmeAppBar
        scrolled={bar.scrolled}
        title="Notifications"
        right={
          <Pressable onPress={() => markRead()} disabled={!data?.unread} accessibilityRole="button" style={({ pressed }) => [styles.markAll, !data?.unread && { opacity: 0.4 }, pressed && { transform: [{ scale: 0.95 }] }]}>
            <Ionicons name="checkmark-done" size={16} color={SME.fg} />
            <Text variant="label" color={SME.fg} fixedColor style={{ fontFamily: fonts.semibold, fontSize: 12 }}>
              Mark all read
            </Text>
          </Pressable>
        }
      />
      <ScrollView onScroll={bar.onScroll} scrollEventThrottle={32} contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 120 }]} showsVerticalScrollIndicator={false}>
        {tabs.length > 1 ? (
          <SmeChips
            items={tabs.map((t) => {
              const n = unreadIn(t);
              return { id: t, label: n ? `${TAB_LABEL[t]} · ${n}` : TAB_LABEL[t] };
            })}
            value={tabs.includes(tab) ? tab : 'ALL'}
            onChange={setTab}
          />
        ) : null}

        {push === 'default' ? (
          <View style={styles.alerts}>
            <Text variant="title" color={SME.fg} fixedColor style={{ fontFamily: fonts.medium, fontSize: 15 }}>
              Get alerts when the app is closed
            </Text>
            <Text variant="bodySm" color={SME.fg3} fixedColor style={{ fontSize: 13 }}>
              Task assignments, approvals and stock alerts will appear on this phone like any other app.
            </Text>
            <Button label="Turn on alerts" icon="notifications" onPress={turnOn} />
          </View>
        ) : null}

        {loading && !data ? null : !shown.length && !earlier.length ? (
          <Empty />
        ) : (
          <>
            {fresh.length ? (
              <Section title="New" count={fresh.length}>
                {fresh.map((n, i) => (
                  <Row key={n.id} n={n} unread index={i} onOpen={open} />
                ))}
              </Section>
            ) : (
              <View style={styles.caughtUp}>
                <Ionicons name="checkmark-done" size={16} color={isDark ? '#6EE7B7' : '#047857'} />
                <Text variant="bodySm" color={isDark ? '#6EE7B7' : '#047857'} fixedColor style={{ fontFamily: fonts.medium, fontSize: 13 }}>
                  You're all caught up
                </Text>
              </View>
            )}
            {earlier.length ? (
              showRead ? (
                <Section title="Read" count={earlier.length}>
                  {earlier.map((n, i) => (
                    <Row key={n.id} n={n} index={i} onOpen={open} />
                  ))}
                </Section>
              ) : (
                <Pressable onPress={() => setShowRead(true)} accessibilityRole="button" style={styles.showRead}>
                  <Text variant="label" color={SME.fg3} fixedColor style={{ fontFamily: fonts.medium, fontSize: 13 }}>
                    Show read ({earlier.length})
                  </Text>
                </Pressable>
              )
            ) : null}
          </>
        )}
      </ScrollView>
      <RoleTabBar />
    </View>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <View>
      <View style={styles.sectionHead}>
        <Text variant="title" color={SME.fg} fixedColor style={{ fontFamily: fonts.semibold, fontSize: 15 }}>
          {title}
        </Text>
        <Text variant="label" color={SME.fg4} fixedColor style={{ fontFamily: fonts.medium, fontSize: 12 }}>
          {count}
        </Text>
      </View>
      <View style={{ gap: 8 }}>{children}</View>
    </View>
  );
}

function Row({ n, unread = false, index, onOpen }: { n: AppNotification; unread?: boolean; index: number; onOpen: (n: AppNotification) => void }) {
  const look = notificationLook(n);
  const icon = look.icon;
  const tone = TONE[look.tone];
  return (
    <Reveal index={Math.min(index, 8)}>
      <Pressable
        onPress={() => onOpen(n)}
        accessibilityRole="button"
        accessibilityLabel={`${unread ? 'New. ' : ''}${n.title}. ${n.body}`}
        style={({ pressed }) => [styles.row, pressed && { transform: [{ scale: 0.99 }] }]}
      >
        <View style={[styles.icon, { backgroundColor: tone.bg }]}>
          <Ionicons name={icon} size={20} color={tone.fg} />
          {/* Red until it is read, then green */}
          <View style={[styles.dot, { backgroundColor: unread ? '#E23B41' : '#2DA043' }]} accessibilityLabel={unread ? 'Unread' : 'Read'} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.titleRow}>
            <Text variant="body" color={SME.fg} fixedColor numberOfLines={2} style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 14 }}>
              {n.title}
            </Text>
            <Text variant="label" color={SME.fg4} fixedColor style={{ fontSize: 11, paddingTop: 2 }}>
              {when(n.createdAt)}
            </Text>
          </View>
          <Text variant="label" color={SME.fg3} fixedColor numberOfLines={2} style={{ fontSize: 12, marginTop: 2, lineHeight: 18 }}>
            {n.body}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={SME.fg5} />
      </Pressable>
    </Reveal>
  );
}

function Empty() {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name="notifications-outline" size={40} color={SME.fg4} />
      </View>
      <Text variant="title" color={SME.fg} fixedColor style={{ fontFamily: fonts.medium, fontSize: 16, marginTop: 24 }}>
        Nothing here
      </Text>
      <Text variant="body" color={SME.fg3} fixedColor align="center" style={{ fontSize: 14, marginTop: 6, maxWidth: 300 }}>
        There's nothing that needs your attention.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: SME.page },
  body: { paddingHorizontal: 16, paddingTop: 8, gap: 20, maxWidth: 672, width: '100%', alignSelf: 'center' },
  markAll: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: SME.surface3 },
  alerts: { gap: space.sm, padding: 16, borderRadius: 16, backgroundColor: SME.surface },
  showRead: { alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 16 },
  caughtUp: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 16, backgroundColor: isDark ? 'rgba(16,185,129,0.1)' : '#ECFDF5' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, marginBottom: 8 },
  // Every notification, read or not, in the same clear card
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, backgroundColor: SME.surface },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', right: -2, top: -2, width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: isDark ? '#1E1E1E' : '#FFFFFF' },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  empty: { alignItems: 'center', paddingHorizontal: 24, paddingVertical: 64 },
  emptyIcon: { width: 96, height: 96, borderRadius: 48, backgroundColor: SME.surface3, alignItems: 'center', justifyContent: 'center' },
});
