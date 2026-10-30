import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import type { TeamMember } from '../../src/api/types';
import { Avatar, Badge, Button, HeaderButton, ListRow, PageHeader, Reveal, Screen, Segmented } from '../../src/components';
import { useApi } from '../../src/hooks/useApi';
import { useAuth } from '../../src/store/auth';
import { colors } from '../../src/theme';
import { humanize, time } from '../../src/utils/format';

type Filter = 'ALL' | 'ON' | 'ABSENT';

export default function Team() {
  const role = useAuth((s) => s.user?.role);
  const { data, refresh, refreshing } = useApi<{ users: TeamMember[] }>('/users');
  const [filter, setFilter] = useState<Filter>('ALL');
  const people = (data?.users ?? [])
    .filter((u) => u.role === 'TECHNICIAN' || u.role === 'STOREKEEPER')
    .filter((u) => (filter === 'ON' ? u.today && !u.today.checkOutAt : filter === 'ABSENT' ? !u.today && u.role === 'TECHNICIAN' : true));

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <PageHeader
        title="Team"
        right={role === 'ADMIN' || role === 'SUPERVISOR' ? <HeaderButton icon="person-add-outline" label="Add a person" onPress={() => router.push('/admin/user-new')} /> : undefined}
      />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button label="Register" icon="calendar-outline" variant="secondary" style={{ flex: 1 }} onPress={() => router.push('/admin/attendance')} />
        {role === 'ADMIN' || role === 'SUPERVISOR' ? <Button label="People" icon="people-outline" style={{ flex: 1 }} onPress={() => router.push('/admin/users')} /> : null}
        {role === 'ADMIN' || role === 'SUPERVISOR' ? <Button label="Create team" icon="people-outline" style={{ flex: 1 }} onPress={() => router.push('/admin/team-new')} /> : null}
      </View>
      <Segmented<Filter>
        options={[
          { value: 'ALL', label: 'Everyone' },
          { value: 'ON', label: 'On duty' },
          { value: 'ABSENT', label: 'Not in' },
        ]}
        value={filter}
        onChange={setFilter}
      />
      <View>
        {people.map((u, idx) => {
          const status = !u.today
            ? { label: 'Not in', tone: 'neutral' as const }
            : u.today.checkOutAt
              ? { label: `Out ${time(u.today.checkOutAt)}`, tone: 'info' as const }
              : u.today.status === 'LATE'
                ? { label: `Late ${time(u.today.checkInAt)}`, tone: 'warning' as const }
                : { label: `In ${time(u.today.checkInAt)}`, tone: 'success' as const };
          return (
            <Reveal key={u.id} index={Math.min(idx, 8)}>
              <ListRow
                flat
                left={<Avatar name={u.name} tint={u.today ? colors.primary : colors.textDim} />}
                title={u.name}
                subtitle={`${humanize(u.role)} · ${u.openTasks} open job(s) · ${u.unitsInCustody} device(s)`}
                right={u.mustChangePassword && u.active ? <Badge label="Not signed in · resend" tone="info" dot={false} /> : <Badge label={status.label} tone={status.tone} />}
                onPress={role === 'ADMIN' || role === 'SUPERVISOR' ? () => router.push(`/admin/user/${u.id}`) : undefined}
              />
            </Reveal>
          );
        })}
      </View>
    </Screen>
  );
}
