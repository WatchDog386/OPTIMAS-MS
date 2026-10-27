import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import type { Task } from '../../src/api/types';
import { EmptyState, HeaderButton, PageHeader, Reveal, Screen, Segmented, TaskCard } from '../../src/components';
import { useAuth } from '../../src/store/auth';
import { useApi } from '../../src/hooks/useApi';

const FILTERS = [
  { value: 'ASSIGNED,IN_PROGRESS', label: 'Open' },
  { value: 'COMPLETED', label: 'To verify' },
  { value: 'VERIFIED', label: 'Verified' },
  { value: 'REJECTED,CANCELLED', label: 'Rejected' },
  { value: '', label: 'All' },
];

export default function AdminJobs() {
  const params = useLocalSearchParams<{ status?: string }>();
  const [filter, setFilter] = useState(params.status ?? FILTERS[0].value);
  const role = useAuth((s) => s.user?.role);
  const { data, refresh, refreshing, loading } = useApi<{ tasks: Task[] }>(`/tasks${filter ? `?status=${filter}` : ''}`);
  const canCreate = role === 'ADMIN' || role === 'SUPERVISOR';

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <PageHeader title="Jobs" right={canCreate ? <HeaderButton icon="add" label="New job" primary onPress={() => router.push('/admin/task-new')} /> : undefined} />
      <Segmented options={FILTERS} value={filter} onChange={setFilter} />
      {data?.tasks.map((t, i) => (
        <Reveal key={t.id} index={Math.min(i, 8)}>
          <TaskCard task={t} showAssignee />
        </Reveal>
      ))}
      {!loading && !data?.tasks.length ? <EmptyState icon="briefcase-outline" title="No jobs" message="Nothing matches this filter." /> : null}
    </Screen>
  );
}
