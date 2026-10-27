import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Contact } from '../../src/api/field';
import { Avatar, EmptyState, Input, PageHeader, Reveal, Screen, Text } from '../../src/components';
import { useApi } from '../../src/hooks/useApi';
import { useAuth } from '../../src/store/auth';
import { colors, space } from '../../src/theme';
import { openChatWith } from '../../src/utils/chat';
import { humanize } from '../../src/utils/format';

/** Pick who to message: the people this account is allowed to talk to. */
export default function NewChat() {
  const role = useAuth((s) => s.user?.role);
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  // Search on the server a moment after typing stops (supervisors can find any customer this way)
  useEffect(() => {
    const t = setTimeout(() => setQuery(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);
  const { data, loading } = useApi<{ support: boolean; contacts: Contact[] }>(`/chat/contacts${query ? `?q=${encodeURIComponent(query)}` : ''}`);
  const contacts = (data?.contacts ?? []).filter((c) => !q.trim() || c.name.toLowerCase().includes(q.trim().toLowerCase()) || (c.customerAccount ?? '').toLowerCase().includes(q.trim().toLowerCase()) || query);
  const managers = role === 'ADMIN' || role === 'SUPERVISOR';

  return (
    <Screen>
      <PageHeader title="New message" right={null} />
      {role !== 'CUSTOMER' ? <Input placeholder={managers ? 'Search staff or customers' : 'Search people'} icon="search" value={q} onChangeText={setQ} autoFocus /> : null}

      {data?.support ? (
        <Pressable onPress={() => openChatWith({ support: true })} style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]} accessibilityRole="button">
          <View style={styles.support}>
            <Ionicons name="headset" size={20} color={colors.onHighlight} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="title">Optimas support</Text>
            <Text variant="label" color={colors.textMuted}>
              The Optimas office
            </Text>
          </View>
        </Pressable>
      ) : null}

      <View>
        {contacts.map((c, i) => (
          <Reveal key={c.id} index={Math.min(i, 8)}>
            <Pressable onPress={() => openChatWith({ userId: c.id })} style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]} accessibilityRole="button" accessibilityLabel={`Message ${c.name}`}>
              <Avatar name={c.name} tint={c.role === 'CUSTOMER' ? colors.accent : c.role === 'TECHNICIAN' ? colors.navy : colors.primary} />
              <View style={{ flex: 1 }}>
                <Text variant="title" numberOfLines={1}>
                  {c.name}
                </Text>
                <Text variant="label" color={colors.textMuted} numberOfLines={1}>
                  {c.reason ?? `${humanize(c.role)}${c.customerAccount ? ` · ${c.customerAccount}` : ''}`}
                </Text>
              </View>
              <Ionicons name="chatbubble-outline" size={18} color={colors.textDim} />
            </Pressable>
          </Reveal>
        ))}
      </View>
      {!loading && data && !contacts.length && !data.support ? (
        <EmptyState icon="people-outline" title="Nobody to message" message={role === 'CUSTOMER' ? 'Your technician appears here once a visit is booked.' : 'Try another name.'} />
      ) : null}
      {role === 'TECHNICIAN' ? (
        <Text variant="label" color={colors.textDim} align="center">
          Customers appear here while you have a job for them (and for two weeks after).
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: space.md, paddingHorizontal: 2 },
  support: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.highlight, alignItems: 'center', justifyContent: 'center' },
});
