import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { TeamMember } from '../../src/api/types';
import { Badge, EmptyState, Input, ListRow, Screen, ScreenHeader, Segmented, Text } from '../../src/components';
import { useApi } from '../../src/hooks/useApi';
import { colors } from '../../src/theme';
import { humanize } from '../../src/utils/format';

type Kind = 'STAFF' | 'CUSTOMER';
type Status = 'true' | 'false';

/** Directory of staff and customer accounts. */
export default function Users() {
  const [kind, setKind] = useState<Kind>('STAFF');
  const [status, setStatus] = useState<Status>('true');
  const [q, setQ] = useState('');
  const query = `/users?active=${status}${kind === 'CUSTOMER' ? '&role=CUSTOMER' : ''}${q.trim().length >= 2 ? `&q=${encodeURIComponent(q.trim())}` : ''}`;
  const { data, refresh, refreshing, loading } = useApi<{ users: TeamMember[] }>(query);

  return (
    <View style={{ flex: 1 }}>
      <Screen refreshing={refreshing} onRefresh={refresh}>
        <ScreenHeader title="People" subtitle="Staff and customer accounts" />
        <Segmented<Kind>
          options={[
            { value: 'STAFF', label: 'Staff' },
            { value: 'CUSTOMER', label: 'Customers' },
          ]}
          value={kind}
          onChange={setKind}
        />
        <Input icon="search" placeholder={kind === 'STAFF' ? 'Name, staff number, phone…' : 'Name, account number, phone…'} value={q} onChangeText={setQ} autoCorrect={false} />
        <Segmented<Status>
          options={[
            { value: 'true', label: 'Active' },
            { value: 'false', label: 'Deactivated' },
          ]}
          value={status}
          onChange={setStatus}
        />
        {!loading && !data?.users.length ? <EmptyState icon="people-outline" title="No accounts" message="Nothing matches these filters." /> : null}
        {data?.users.map((u) => (
          <ListRow
            key={u.id}
            icon={u.role === 'CUSTOMER' ? 'home-outline' : 'person-outline'}
            iconTint={colors.text}
            title={u.name}
            subtitle={u.role === 'CUSTOMER' ? [u.customerAccount, u.phone].filter(Boolean).join(' · ') : `${u.staffNo} · ${humanize(u.role)}${u.region ? ` · ${u.region}` : ''}`}
            right={u.mustChangePassword ? <Badge label="Not signed in · resend" tone="info" dot={false} /> : u.role === 'TECHNICIAN' && u.unitsInCustody ? <Badge label={`${u.unitsInCustody} dev`} tone="neutral" dot={false} /> : undefined}
            onPress={() => router.push(`/admin/user/${u.id}`)}
          />
        ))}
        <Text variant="label" color={colors.textDim} align="center">
          {data ? `${data.users.length} account(s)` : ''}
        </Text>
      </Screen>
      <Pressable style={styles.fab} onPress={() => router.push(`/admin/user-new?role=${kind === 'CUSTOMER' ? 'CUSTOMER' : 'TECHNICIAN'}`)} accessibilityLabel="Add account">
        <Ionicons name="person-add" size={24} color={colors.onPrimary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  fab: { position: 'absolute', right: 20, bottom: 28, width: 58, height: 58, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
});
