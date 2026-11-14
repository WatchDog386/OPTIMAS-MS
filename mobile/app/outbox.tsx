import { Image, Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Button, EmptyState, Screen, ScreenHeader, Text } from '../src/components';
import { SME } from '../src/components/SmeKit';
import { clearSent, phoneOffline, remove, retry, syncNow, useOutbox, type OutboxItem } from '../src/offline/outbox';
import { useNetwork } from '../src/store/network';
import { confirmDialog } from '../src/store/feedback';
import { fonts, isDark } from '../src/theme';

/*
 * The outbox: everything done on this phone that is on its way to the office, with WhatsApp's ticks.
 * A clock while it waits for a signal, one tick while it is being sent, two ticks once the office has
 * it, and a red mark with the reason when the office refused it.
 */

const TICK = isDark ? '#53BDEB' : '#0EA5E9';

function when(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  const today = new Date().toDateString() === d.toDateString();
  const t = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return today ? t : `${d.toLocaleDateString([], { day: 'numeric', month: 'short' })} ${t}`;
}

function StateMark({ item }: { item: OutboxItem }) {
  if (item.state === 'sent') return <Ionicons name="checkmark-done" size={18} color={TICK} accessibilityLabel="Sent" />;
  if (item.state === 'sending') return <Ionicons name="checkmark" size={18} color={SME.fg4} accessibilityLabel="Sending" />;
  if (item.state === 'failed') return <Ionicons name="alert-circle" size={18} color="#DC2626" accessibilityLabel="Not sent" />;
  return <Ionicons name="time-outline" size={17} color={SME.fg4} accessibilityLabel="Waiting for a signal" />;
}

export default function Outbox() {
  const items = useOutbox();
  const reachable = useNetwork((s) => s.online);
  const offline = phoneOffline() || !reachable;
  const waiting = items.filter((i) => i.state === 'waiting' || i.state === 'sending').length;
  const failed = items.filter((i) => i.state === 'failed').length;
  const sent = items.filter((i) => i.state === 'sent').length;

  return (
    <Screen onRefresh={() => void syncNow()} refreshing={false}>
      <ScreenHeader title="Outbox" />

      <View style={[styles.hero, { backgroundColor: offline ? (isDark ? '#2A2B2D' : '#EEF0EF') : isDark ? 'rgba(45,160,67,0.16)' : '#E3F4EA' }]}>
        <Ionicons name={offline ? 'cloud-offline-outline' : waiting ? 'cloud-upload-outline' : 'cloud-done-outline'} size={26} color={offline ? SME.fg3 : isDark ? '#8FD14F' : '#2DA043'} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="title" color={SME.fg} fixedColor style={{ fontFamily: fonts.semibold, fontSize: 15 }}>
            {offline ? 'You are offline' : waiting ? `Sending ${waiting}…` : 'Everything is sent'}
          </Text>
          <Text variant="label" color={SME.fg3} fixedColor style={{ fontSize: 12, lineHeight: 17 }}>
            {offline
              ? 'Keep working. Check-ins, photos, tasks and reports are saved on this phone and sent by themselves, in order, as soon as you are back online.'
              : waiting
                ? 'Your work saved offline is reaching the office now.'
                : 'The office has everything you did on this phone.'}
          </Text>
        </View>
      </View>

      {offline && waiting ? null : waiting ? <Button label="Send now" icon="refresh" variant="secondary" onPress={() => void syncNow()} /> : null}

      {!items.length ? <EmptyState icon="paper-plane-outline" title="Nothing waiting" message="Work you do with no internet appears here until it has been sent." /> : null}

      <View style={{ gap: 2 }}>
        {items.map((i) => (
          <View key={i.id} style={styles.row}>
            <View style={[styles.icon, i.state === 'failed' && { backgroundColor: isDark ? 'rgba(220,38,38,0.18)' : '#FEE2E2' }]}>
              {i.photo?.dataUri ? (
                <Image source={{ uri: i.photo.dataUri }} style={styles.thumb} />
              ) : (
                <Ionicons name={i.photo ? 'camera-outline' : i.path.includes('attendance') ? 'finger-print-outline' : i.path.includes('day-report') ? 'document-text-outline' : i.path.includes('chat') ? 'chatbubble-outline' : i.path.includes('inventory') ? 'cube-outline' : 'briefcase-outline'} size={19} color={SME.fg3} />
              )}
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
              <Text variant="body" color={SME.fg} fixedColor numberOfLines={2} style={{ fontFamily: fonts.medium, fontSize: 14 }}>
                {i.label}
              </Text>
              <Text variant="label" color={i.state === 'failed' ? '#DC2626' : SME.fg4} fixedColor numberOfLines={3} style={{ fontSize: 12 }}>
                {i.state === 'failed'
                  ? `Not sent: ${i.error}`
                  : i.state === 'sent'
                    ? `Done ${when(i.createdAt)} · sent ${when(i.sentAt)}`
                    : i.state === 'sending'
                      ? `Done ${when(i.createdAt)} · sending…`
                      : `Done ${when(i.createdAt)} · waiting for a signal`}
              </Text>
              {i.state === 'failed' ? (
                <View style={{ flexDirection: 'row', gap: 14, marginTop: 6 }}>
                  <Pressable onPress={() => void retry(i.id)} accessibilityRole="button" hitSlop={8}>
                    <Text variant="label" color={isDark ? '#8FD14F' : '#2DA043'} fixedColor style={{ fontFamily: fonts.semibold, fontSize: 13 }}>
                      Retry
                    </Text>
                  </Pressable>
                  {i.taskId ? (
                    <Pressable onPress={() => router.push(`/task/${i.taskId}`)} accessibilityRole="button" hitSlop={8}>
                      <Text variant="label" color={SME.fg} fixedColor style={{ fontFamily: fonts.semibold, fontSize: 13 }}>
                        Open task
                      </Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    onPress={async () => {
                      if (await confirmDialog({ title: 'Remove it?', message: `"${i.label}" will not be sent to the office.`, confirmLabel: 'Remove', tone: 'danger' })) void remove(i.id);
                    }}
                    accessibilityRole="button"
                    hitSlop={8}
                  >
                    <Text variant="label" color="#DC2626" fixedColor style={{ fontFamily: fonts.semibold, fontSize: 13 }}>
                      Remove
                    </Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
            <StateMark item={i} />
          </View>
        ))}
      </View>

      {sent && !waiting && !failed ? <Button label="Clear sent" variant="ghost" onPress={() => void clearSent()} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 4 },
  icon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: SME.surface, overflow: 'hidden' },
  thumb: { width: 42, height: 42 },
});
