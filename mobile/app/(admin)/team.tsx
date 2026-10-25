import { useState } from 'react';
import { router } from 'expo-router';
import type { TeamMember } from '../../src/api/types';
import { Avatar, Badge, Button, ListRow, Screen, Segmented, Text } from '../../src/components';
import { useApi } from '../../src/hooks/useApi';
import { colors } from '../../src/theme';
import { humanize, time } from '../../src/utils/format';

type Filter = 'ALL' | 'ON' | 'ABSENT';

export default function Team() {
  const { data, refresh, refreshing } = useApi<{ users: TeamMember[] }>('/users');
  const [filter, setFilter] = useState<Filter>('ALL');
  const people = (data?.users ?? [])
    .filter((u) => u.role === 'TECHNICIAN' || u.role === 'STOREKEEPER')
    .filter((u) => (filter === 'ON' ? u.today && !u.today.checkOutAt : filter === 'ABSENT' ? !u.today && u.role === 'TECHNICIAN' : true));

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Text variant="h1">Team</Text>
      <Button label="Daily attendance register" icon="calendar-outline" variant="secondary" onPress={() => router.push('/admin/attendance')} />
      <Segmented<Filter>
        options={[
          { value: 'ALL', label: 'Everyone' },
          { value: 'ON', label: 'On duty' },
          { value: 'ABSENT', label: 'Not in' },
        ]}
        value={filter}
        onChange={setFilter}
      />
      {people.map((u) => {
        const status = !u.today
          ? { label: 'Not in', tone: 'neutral' as const }
          : u.today.checkOutAt
            ? { label: `Out ${time(u.today.checkOutAt)}`, tone: 'info' as const }
            : u.today.status === 'LATE'
              ? { label: `Late ${time(u.today.checkInAt)}`, tone: 'warning' as const }
              : { label: `In ${time(u.today.checkInAt)}`, tone: 'success' as const };
        return (
          <ListRow
            key={u.id}
            left={<Avatar name={u.name} tint={u.today ? colors.primary : colors.textDim} />}
            title={u.name}
            subtitle={`${humanize(u.role)} · ${u.openTasks} open job(s) · ${u.unitsInCustody} device(s)`}
            right={<Badge label={status.label} tone={status.tone} />}
          />
        );
      })}
    </Screen>
  );
}
