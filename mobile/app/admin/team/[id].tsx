import { StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { api, ApiError } from '../../../src/api/client';
import type { JobTeam } from '../../../src/api/types';
import { Button, Glass, Loading, Pill, Screen, ScreenHeader, Section, SectionRow, Text } from '../../../src/components';
import { useApi } from '../../../src/hooks/useApi';
import { useAuth } from '../../../src/store/auth';
import { colors, fonts } from '../../../src/theme';
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
  const canManage = role === 'ADMIN' || role === 'SUPERVISOR';

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

  return (
    <Screen refreshing={refreshing} onRefresh={reload}>
      <ScreenHeader title={team.name} subtitle={`${team.members.length} technician(s)`} />

      <Glass strong style={{ gap: 6 }}>
        <Row label="Team leader" value={team.leader.name} />
        <Row label="Members" value={String(team.members.length)} />
        <Row label="Open jobs" value={String(team.openJobs ?? 0)} />
      </Glass>

      <Section title="Members" subtitle="Everyone in the crew sees the team's jobs and alerts">
        {team.members.map((m) => (
          <SectionRow
            key={m.id}
            icon={m.userId === team.leaderId ? 'star' : 'person-outline'}
            tint={m.userId === team.leaderId ? colors.accent : colors.text}
            tintBg={m.userId === team.leaderId ? colors.accentSoft : colors.highlight}
            title={m.user.name}
            subtitle={m.user.staffNo}
            right={m.userId === team.leaderId ? <Pill label="Leader" tone="neutral" /> : undefined}
          />
        ))}
      </Section>

      {canManage ? (
        <Section title="Manage team">
          <View style={styles.actions}>
            <Button label="Edit team" icon="create-outline" variant="secondary" style={{ flex: 1 }} onPress={() => router.push(`/admin/team-edit?id=${team.id}`)} />
          </View>
          <Button label="Delete team" icon="trash-outline" variant="danger" loading={busy} onPress={handleDelete} style={{ marginTop: 10 }} />
        </Section>
      ) : (
        <Text variant="bodySm" color={colors.textMuted} align="center">
          Only admins and supervisors can change this team.
        </Text>
      )}
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text variant="bodySm" color={colors.textMuted}>
        {label}
      </Text>
      <Text variant="bodySm" style={{ fontFamily: fonts.semibold, flexShrink: 1, textAlign: 'right' }}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 3 },
  actions: { flexDirection: 'row', gap: 10 },
});
