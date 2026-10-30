import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ConversationRow, Tick } from '../api/field';
import { useApi } from '../hooks/useApi';
import { homeFor, useAuth } from '../store/auth';
import { colors, fonts, space } from '../theme';
import { openChatWith } from '../utils/chat';
import { Avatar } from './Avatar';
import { EmptyState } from './EmptyState';
import { Reveal, Skeleton } from './Motion';
import { PageHeader } from './PageHeader';
import { Screen, TAB_BAR_CLEARANCE } from './Screen';
import { Text } from './Text';

const ROLE_TINT: Record<string, string> = { TECHNICIAN: colors.navy, CUSTOMER: colors.accent, SUPPORT: colors.success, ADMIN: colors.primary, SUPERVISOR: colors.primary, STOREKEEPER: colors.warning, TEAM: colors.brand };
/** WhatsApp's read-tick blue. */
export const READ_BLUE = '#53BDEB';
/** Dark green text on the selected filter chip. */
const CHIP_GREEN = '#14632A';

/** "10:42" today, "Yesterday", or "12 Oct". */
export function chatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const day = (x: Date) => x.toLocaleDateString('en-KE', { timeZone: 'Africa/Nairobi' });
  if (day(d) === day(now)) return d.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Africa/Nairobi' });
  if (day(d) === day(new Date(now.getTime() - 86_400_000))) return 'Yesterday';
  return d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short', timeZone: 'Africa/Nairobi' });
}

/** One grey tick (sent), two grey (delivered), two blue (read), a clock while sending. */
export function Ticks({ status, size = 16, color = colors.textDim }: { status: Tick | 'pending'; size?: number; color?: string }) {
  const name = status === 'pending' ? 'time-outline' : status === 'sent' ? 'checkmark' : 'checkmark-done';
  const label = status === 'pending' ? 'Sending' : status === 'sent' ? 'Sent' : status === 'delivered' ? 'Delivered' : 'Read';
  return <Ionicons name={name} size={size} color={status === 'read' ? READ_BLUE : color} accessibilityLabel={label} />;
}

type Filter = 'ALL' | 'UNREAD' | 'GROUPS' | 'CUSTOMERS' | 'STAFF';

/** Every conversation, newest first: search, filter chips, ticks and unread counts (the WhatsApp Chats tab). */
export function ChatInbox({ tab }: { tab?: boolean }) {
  const insets = useSafeAreaInsets();
  const role = useAuth((s) => s.user?.role);
  const { data, refresh, refreshing, loading } = useApi<{ conversations: ConversationRow[] }>('/chat/conversations', { poll: 10_000 });
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('ALL');
  const customer = role === 'CUSTOMER';

  const all = useMemo(() => data?.conversations ?? [], [data]);
  const is: Record<Filter, (c: ConversationRow) => boolean> = {
    ALL: () => true,
    UNREAD: (c) => c.unread > 0,
    GROUPS: (c) => c.kind === 'TEAM',
    CUSTOMERS: (c) => c.role === 'CUSTOMER',
    STAFF: (c) => c.kind === 'DIRECT' && c.role !== 'CUSTOMER',
  };
  const chips: { key: Filter; label: string; n?: number }[] = [
    { key: 'ALL', label: 'All' },
    { key: 'UNREAD', label: 'Unread', n: all.filter(is.UNREAD).length },
    ...(customer ? [] : [{ key: 'GROUPS' as Filter, label: 'Groups', n: all.filter(is.GROUPS).length }, { key: 'CUSTOMERS' as Filter, label: 'Customers' }, { key: 'STAFF' as Filter, label: 'Staff' }]),
  ];
  const needle = q.trim().toLowerCase();
  const rows = all.filter(is[filter]).filter((c) => !needle || `${c.title} ${c.subtitle} ${c.lastMessage?.body ?? ''}`.toLowerCase().includes(needle));

  return (
    <View style={{ flex: 1 }}>
      <Screen refreshing={refreshing} onRefresh={refresh}>
        <PageHeader title="Chats" onBack={tab ? () => router.replace(homeFor(role) as never) : undefined} />

        <View style={styles.search}>
          <Ionicons name="search" size={20} color={colors.textMuted} />
          <TextInput value={q} onChangeText={setQ} placeholder="Search" placeholderTextColor={colors.textMuted} style={styles.searchInput} accessibilityLabel="Search chats" />
          {q ? (
            <Pressable onPress={() => setQ('')} hitSlop={8} accessibilityLabel="Clear search">
              <Ionicons name="close-circle" size={18} color={colors.textDim} />
            </Pressable>
          ) : null}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {chips.map((c) => {
            const on = filter === c.key;
            return (
              <Pressable key={c.key} onPress={() => setFilter(c.key)} style={[styles.chip, on && styles.chipOn]} accessibilityRole="tab" accessibilityState={{ selected: on }}>
                <Text variant="bodySm" color={on ? CHIP_GREEN : colors.textMuted} style={{ fontFamily: on ? fonts.semibold : fonts.medium }}>
                  {c.label}
                  {c.n ? ` ${c.n}` : ''}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {customer ? (
          <Pressable onPress={() => openChatWith({ support: true })} style={({ pressed }) => [styles.row, pressed && styles.pressed]} accessibilityRole="button">
            <View style={[styles.supportIcon, { width: 52, height: 52, borderRadius: 26 }]}>
              <Ionicons name="headset" size={24} color={colors.onHighlight} />
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text variant="title" style={styles.name}>
                Optimas support
              </Text>
              <Text variant="bodySm" color={colors.textMuted} numberOfLines={1}>
                Billing, faults and anything else
              </Text>
            </View>
          </Pressable>
        ) : null}

        {!data && loading ? (
          <View style={{ gap: 14 }}>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} height={62} radius={18} />
            ))}
          </View>
        ) : rows.length ? (
          <View>
            {rows.map((c, i) => (
              <Reveal key={c.id} index={Math.min(i, 8)}>
                <ChatRow chat={c} />
              </Reveal>
            ))}
          </View>
        ) : (
          <EmptyState
            icon="chatbubbles-outline"
            title={needle ? 'No matches' : filter !== 'ALL' ? 'Nothing here' : 'No chats yet'}
            message={customer ? 'Message your technician or the Optimas office here.' : 'Start a chat with your team or a customer. Every team gets its own group.'}
          />
        )}
      </Screen>

      {/* New chat, bottom right like WhatsApp */}
      <Pressable
        onPress={() => router.push('/chat/new')}
        accessibilityRole="button"
        accessibilityLabel="New chat"
        style={({ pressed }) => [styles.fab, { bottom: (tab ? TAB_BAR_CLEARANCE : 24) + insets.bottom }, pressed && { transform: [{ scale: 0.94 }] }]}
      >
        <Ionicons name="chatbox-ellipses" size={24} color={colors.white} />
      </Pressable>
    </View>
  );
}

function ChatRow({ chat: c }: { chat: ConversationRow }) {
  const last = c.lastMessage;
  const group = c.kind === 'TEAM';
  return (
    <Pressable onPress={() => router.push(`/chat/${c.id}`)} style={({ pressed }) => [styles.row, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={`${c.title}${c.unread ? `, ${c.unread} unread` : ''}`}>
      {group ? (
        <View style={styles.groupIcon}>
          <Ionicons name="people" size={24} color={colors.white} />
        </View>
      ) : c.role === 'SUPPORT' ? (
        <View style={[styles.supportIcon, { width: 52, height: 52, borderRadius: 26 }]}>
          <Ionicons name="headset" size={24} color={colors.onHighlight} />
        </View>
      ) : (
        <Avatar name={c.title} size={52} tint={ROLE_TINT[c.role ?? ''] ?? colors.primary} />
      )}
      <View style={{ flex: 1, gap: 3 }}>
        <View style={styles.line}>
          <Text variant="title" numberOfLines={1} style={[styles.name, { flex: 1 }]}>
            {c.title}
          </Text>
          <Text variant="label" color={c.unread ? colors.brand : colors.textMuted} style={c.unread ? { fontFamily: fonts.semibold } : undefined}>
            {chatTime(c.at)}
          </Text>
        </View>
        <View style={styles.line}>
          {last?.mine && last.status ? <Ticks status={last.status} /> : null}
          <Text variant="bodySm" color={colors.textMuted} numberOfLines={1} style={{ flex: 1 }}>
            {last ? `${group && !last.mine ? `~${last.sender}: ` : ''}${last.body}` : `${c.members} members · say hello to the team`}
          </Text>
          {c.unread ? (
            <View style={styles.count}>
              <Text variant="label" color={colors.white} fixedColor style={{ fontFamily: fonts.bold, fontSize: 11 }}>
                {c.unread > 99 ? '99+' : c.unread}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 48, paddingHorizontal: 16, borderRadius: 24, backgroundColor: colors.surfaceAlt },
  searchInput: { flex: 1, height: 48, fontFamily: fonts.regular, fontSize: 16, color: colors.text, outlineStyle: 'none' } as object,
  chips: { gap: 8, paddingVertical: 2 },
  chip: { height: 36, paddingHorizontal: 14, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.glassStrong },
  chipOn: { backgroundColor: colors.brandSoft, borderColor: colors.brandSoft },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 11, paddingHorizontal: 2 },
  pressed: { opacity: 0.6 },
  name: { fontFamily: fonts.semibold, fontSize: 16 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  count: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', marginLeft: 4 },
  groupIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#8696A0', alignItems: 'center', justifyContent: 'center' },
  supportIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.highlight, alignItems: 'center', justifyContent: 'center' },
  fab: {
    position: 'absolute',
    right: 20,
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
