import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { ConversationRow } from '../api/field';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../store/auth';
import { colors, fonts, space } from '../theme';
import { openChatWith } from '../utils/chat';
import { Avatar } from './Avatar';
import { EmptyState } from './EmptyState';
import { Input } from './Input';
import { Reveal, Skeleton } from './Motion';
import { HeaderButton, PageHeader } from './PageHeader';
import { Screen } from './Screen';
import { Text } from './Text';

const ROLE_TINT: Record<string, string> = { TECHNICIAN: colors.navy, CUSTOMER: colors.accent, SUPPORT: colors.success, ADMIN: colors.primary, SUPERVISOR: colors.primary, STOREKEEPER: colors.warning };

/** "10:42" today, "Yesterday", or "12 Oct". */
export function chatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const day = (x: Date) => x.toLocaleDateString('en-KE', { timeZone: 'Africa/Nairobi' });
  if (day(d) === day(now)) return d.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Africa/Nairobi' });
  if (day(d) === day(new Date(now.getTime() - 86_400_000))) return 'Yesterday';
  return d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short', timeZone: 'Africa/Nairobi' });
}

/** Every conversation, newest first, with what is unread. Used by the Messages page and the technicians' Chats tab. */
export function ChatInbox({ tab }: { tab?: boolean }) {
  const role = useAuth((s) => s.user?.role);
  const { data, refresh, refreshing, loading } = useApi<{ conversations: ConversationRow[] }>('/chat/conversations', { poll: 10_000 });
  const [q, setQ] = useState('');
  const rows = (data?.conversations ?? []).filter((c) => !q.trim() || `${c.title} ${c.subtitle} ${c.lastMessage.body}`.toLowerCase().includes(q.trim().toLowerCase()));
  const customer = role === 'CUSTOMER';

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <PageHeader title="Messages" onBack={tab ? () => router.replace('/home') : undefined} right={<HeaderButton icon="create-outline" label="New message" primary onPress={() => router.push('/chat/new')} />} />
      {(data?.conversations.length ?? 0) > 4 ? <Input placeholder="Search messages" icon="search" value={q} onChangeText={setQ} /> : null}

      {customer ? (
        <Pressable onPress={() => openChatWith({ support: true })} style={({ pressed }) => [styles.support, pressed && { opacity: 0.85 }]} accessibilityRole="button">
          <View style={styles.supportIcon}>
            <Ionicons name="headset" size={22} color={colors.onHighlight} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="title">Chat with Optimas support</Text>
            <Text variant="label" color={colors.textMuted}>
              Billing, faults and anything else
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>
      ) : null}

      {!data && loading ? (
        <View style={{ gap: 14 }}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} height={58} radius={18} />
          ))}
        </View>
      ) : rows.length ? (
        <View>
          {rows.map((c, i) => (
            <Reveal key={c.id} index={Math.min(i, 8)}>
              <Pressable onPress={() => router.push(`/chat/${c.id}`)} style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]} accessibilityRole="button" accessibilityLabel={`${c.title}${c.unread ? `, ${c.unread} new` : ''}`}>
                <View>
                  {c.role === 'SUPPORT' ? (
                    <View style={[styles.supportIcon, { width: 44, height: 44 }]}>
                      <Ionicons name="headset" size={20} color={colors.onHighlight} />
                    </View>
                  ) : (
                    <Avatar name={c.title} tint={ROLE_TINT[c.role ?? ''] ?? colors.primary} />
                  )}
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={styles.line}>
                    <Text variant="title" numberOfLines={1} style={{ flex: 1, fontFamily: c.unread ? fonts.bold : fonts.semibold }}>
                      {c.title}
                    </Text>
                    <Text variant="label" color={c.unread ? colors.success : colors.textDim} style={c.unread ? { fontFamily: fonts.semibold } : undefined}>
                      {chatTime(c.lastMessage.at)}
                    </Text>
                  </View>
                  <View style={styles.line}>
                    <Text variant="bodySm" color={c.unread ? colors.text : colors.textMuted} numberOfLines={1} style={{ flex: 1 }}>
                      {c.lastMessage.mine ? 'You: ' : ''}
                      {c.lastMessage.body}
                    </Text>
                    {c.unread ? (
                      <View style={styles.count}>
                        <Text variant="label" color={colors.white} fixedColor style={{ fontFamily: fonts.bold, fontSize: 11 }}>
                          {c.unread > 99 ? '99+' : c.unread}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text variant="label" color={colors.textDim} numberOfLines={1}>
                    {c.subtitle}
                  </Text>
                </View>
              </Pressable>
            </Reveal>
          ))}
        </View>
      ) : (
        <EmptyState icon="chatbubbles-outline" title={q ? 'No matches' : 'No messages yet'} message={customer ? 'Message your technician or the Optimas office here.' : 'Start a conversation with your team or a customer.'} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: space.md, paddingHorizontal: 2 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  count: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center' },
  support: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: space.lg, borderRadius: 22, backgroundColor: colors.glassStrong, borderWidth: 1, borderColor: colors.glassBorder },
  supportIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.highlight, alignItems: 'center', justifyContent: 'center' },
});
