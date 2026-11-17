import { View } from 'react-native';
import { router } from 'expo-router';
import type { JobTeam } from '../../src/api/types';
import { Button, HeaderButton, ListRow, PageHeader, Screen, Text } from '../../src/components';
import { useApi } from '../../src/hooks/useApi';
import { useAuth } from '../../src/store/auth';
import { colors } from '../../src/theme';

/** All saved crews: open one to review its members, edit it, or remove it. */
export default function Teams() {
  const role = useAuth((s) => s.user?.role);
  const { data, refreshing } = useApi<{ teams: JobTeam[] }>('/teams');
  const teams = (data?.teams ?? []).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Screen refreshing={refreshing}>
      <PageHeader
        title="Teams"
        subtitle="Crews that take jobs together"
        right={role === 'ADMIN' || role === 'SUPERVISOR' ? <HeaderButton icon="person-add-outline" label="New team" onPress={() => router.push('/admin/team-new')} /> : undefined}
      />
      <View style={{ paddingHorizontal: 16 }}>
        {teams.length === 0 ? (
          <Text variant="bodySm" color={colors.textMuted} style={{ marginTop: 24, textAlign: 'center' }}>
            No teams yet. Create one to allocate jobs to a whole crew.
          </Text>
        ) : (
          teams.map((t) => (
            <ListRow
              key={t.id}
              left={{ icon: 'people-outline' }}
              title={t.name}
              subtitle={`${t.members.length} technician(s) · led by ${t.leader.name} · ${t.openJobs ?? 0} open job(s)`}
              right={{ icon: 'chevron-forward-outline' }}
              onPress={() => router.push(`/admin/team/${t.id}`)}
            />
          ))
        )}
      </View>
    </Screen>
  );
}
