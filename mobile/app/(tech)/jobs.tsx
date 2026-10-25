import { useState } from 'react';
import type { Task } from '../../src/api/types';
import { EmptyState, Screen, Segmented, TaskCard, Text } from '../../src/components';
import { useApi } from '../../src/hooks/useApi';
import { colors } from '../../src/theme';

const FILTERS = [
  { value: 'IN_PROGRESS,ASSIGNED', label: 'Active' },
  { value: 'COMPLETED,VERIFIED', label: 'Completed' },
  { value: 'REJECTED', label: 'Returned' },
  { value: '', label: 'All' },
];

export default function Jobs() {
  const [filter, setFilter] = useState(FILTERS[0].value);
  const { data, refreshing, refresh, loading } = useApi<{ tasks: Task[] }>(`/tasks${filter ? `?status=${filter}` : ''}`);
  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Text variant="h1">My jobs</Text>
      <Text variant="bodySm" color={colors.textMuted}>
        Take a photo when you start and when you finish every job.
      </Text>
      <Segmented options={FILTERS} value={filter} onChange={setFilter} />
      {data?.tasks.map((t) => <TaskCard key={t.id} task={t} />)}
      {!loading && !data?.tasks.length ? <EmptyState icon="briefcase-outline" title="Nothing here" message="No jobs match this filter." /> : null}
    </Screen>
  );
}
