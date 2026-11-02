import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import type { Task, TaskStatus } from '../../src/api/types';
import { Button, EmptyState, HeaderButton, PageHeader, Reveal, Screen, Segmented, TaskCard, Text } from '../../src/components';
import { useApi } from '../../src/hooks/useApi';
import { colors, space } from '../../src/theme';

type Show = 'assign' | 'open' | 'done';
const STATUSES: Record<Show, TaskStatus[]> = { assign: ['OPEN'], open: ['ASSIGNED', 'IN_PROGRESS'], done: ['COMPLETED', 'VERIFIED', 'REJECTED', 'CANCELLED'] };

/**
 * Customer care's jobs: the ones saved to assign later (give them out once the technicians are in),
 * the ones on the road (follow or transfer them), and finished ones with their reports.
 */
export default function CareJobs() {
  const toAssign = useApi<{ tasks: Task[] }>('/tasks?status=OPEN', { poll: 30_000 });
  const waiting = toAssign.data?.tasks.length ?? 0;
  const [show, setShow] = useState<Show>(waiting ? 'assign' : 'open');
  // Open on "To assign" when jobs are waiting, unless a tab was already picked
  const picked = useRef(false);
  useEffect(() => {
    if (!picked.current && waiting) setShow('assign');
  }, [waiting]);
  const pick = (v: Show) => {
    picked.current = true;
    setShow(v);
  };
  const { data, refresh, refreshing, loading } = useApi<{ tasks: Task[] }>(`/tasks?status=${STATUSES[show].join(',')}`, { poll: 30_000 });
  const tasks = data?.tasks ?? [];

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={() => {
        refresh();
        toAssign.refresh();
      }}
    >
      <PageHeader title="Jobs" right={<HeaderButton icon="add" label="New job" primary onPress={() => router.push('/admin/task-new')} />} />
      <Segmented
        options={[
          { value: 'assign', label: waiting ? `To assign · ${waiting}` : 'To assign' },
          { value: 'open', label: 'Open' },
          { value: 'done', label: 'Finished' },
        ]}
        value={show}
        onChange={pick}
      />
      {show !== 'done' ? <Button label="Who is in today" icon="people-outline" variant="outline" onPress={() => router.push('/team-today')} /> : null}
      {!loading && !tasks.length ? (
        <EmptyState
          icon="briefcase-outline"
          title={show === 'assign' ? 'Nothing to assign' : 'No jobs here'}
          message={show === 'assign' ? 'Jobs saved with Create job wait here until you give them to a technician or team.' : "Tap New job to log a customer's issue and send it to a technician."}
        />
      ) : null}
      {tasks.map((t, i) => (
        <Reveal key={t.id} index={Math.min(i, 8)}>
          <View style={{ gap: space.sm }}>
            <TaskCard task={t} showAssignee />
            {t.status === 'OPEN' ? (
              <View style={{ flexDirection: 'row', gap: space.sm }}>
                <Button label="Nearest" icon="git-branch-outline" variant="secondary" onPress={() => router.push(`/admin/forward/${t.id}`)} style={{ flex: 1 }} />
                <Button label="Assign" icon="person-add-outline" onPress={() => router.push(`/admin/task-edit?id=${t.id}`)} style={{ flex: 1.3 }} />
              </View>
            ) : t.status === 'ASSIGNED' ? (
              <View style={{ flexDirection: 'row', gap: space.sm }}>
                <Button label="Track" icon="navigate-outline" variant="secondary" onPress={() => router.push(`/track/${t.id}`)} style={{ flex: 1 }} />
                <Button label="Transfer" icon="git-branch-outline" variant="secondary" onPress={() => router.push(`/admin/forward/${t.id}`)} style={{ flex: 1 }} />
              </View>
            ) : t.status === 'IN_PROGRESS' ? (
              <Button label="Track" icon="navigate-outline" variant="secondary" onPress={() => router.push(`/track/${t.id}`)} />
            ) : null}
          </View>
        </Reveal>
      ))}
      {show === 'done' && tasks.length ? (
        <Text variant="label" color={colors.textMuted} align="center">
          Open a job to read the technician’s report.
        </Text>
      ) : null}
    </Screen>
  );
}
