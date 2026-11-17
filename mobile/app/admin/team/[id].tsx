import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { api, ApiError } from '../../../src/api/client';
import type { JobTeam } from '../../../src/api/types';
import { Button, ListRow, Loading, Screen, ScreenHeader, SectionHeader } from '../../../src/components';
import { useApi } from '../../../src/hooks/useApi';
import { useAuth } from '../../../src/store/auth';
import { confirmAction } from '../../../src/utils/confirm';
import { goBack } from '../../../src/utils/nav';
import { toast } from '../../../src/store/feedback';

/** Review a single team: leader, members, open jobs. Admins/supervisors can edit or remove it. */
export default function TeamDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const role = useAuth((s) => s.user?.role);
  const { data, refreshing, reload } = useApi<{ team: JobTeam }>(`/teams/${id}`);
  const [busy, setBusy] = useState(false);

  if (!data) return <Loading />;
  const team = data.team;

  const handleDelete = async () => {
    if (!(await confirmAction('Delete team', `Remove “${team.name}”? Past jobs stay on record. Open jobs must be finished first.`, 'Delete'))) return;
    setBusy(true);
    try {
      await api(`/teams/${id}`, { method: 'DELETE' });
      toast.success('Team removed');
      goBack();
    } catch (e) {
      toast.error('Could not delete team', e instanceof ApiError ? e.message : 'Try again');
    } finally {
      setBusy(false);
    }
  };

  const canManage = role === 'ADMIN' || role === 'SUPERVISOR';

  return (
    <Screen refreshing={refreshing} onRefresh={reload}>
      <ScreenHeader
        title={team.name}
        right={canManage ? (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button label="Edit" icon="pencil-outline" variant="outline" onPress={() => router.push(`/admin/team-edit?id=${team.id}`)} />
            <Button label="Delete" icon="trash-outline" variant="danger" loading={busy} onPress={handleDelete} />
          </View>
        ) : undefined}
      />
      <SectionHeader title="Team" />
      <ListRow icon="star-outline" title="Leader" subtitle={team.leader.name} />
      <ListRow icon="people-outline" title="Members" subtitle={team.members.map((m) => m.user.name).join(', ')} />
      <ListRow icon="construct-outline" title="Open jobs" subtitle={String(team.openJobs ?? 0)} />
    </Screen>
  );
}
