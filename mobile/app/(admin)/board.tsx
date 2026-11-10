import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { EarlierJobs, EmptyState, HeaderButton, PageHeader, Screen, Segmented, TaskList } from '../../src/components';
import { useAuth } from '../../src/store/auth';
import { useTodayJobs } from '../../src/hooks/useTodayJobs';

const FILTERS = [
  { value: 'OPEN', label: 'To assign' },
  { value: 'ASSIGNED,IN_PROGRESS', label: 'Open' },
  { value: 'COMPLETED', label: 'To verify' },
  { value: 'VERIFIED', label: 'Verified' },
  { value: 'REJECTED,CANCELLED', label: 'Rejected' },
  { value: '', label: 'All' },
];

export default function AdminJobs() {
  const params = useLocalSearchParams<{ status?: string }>();
  const [filter, setFilter] = useState(params.status ?? 'ASSIGNED,IN_PROGRESS');
  const role = useAuth((s) => s.user?.role);
  const { data, refresh, refreshing, loading, earlier, earlierShown, showEarlier } = useTodayJobs(filter);
  const canCreate = role === 'ADMIN' || role === 'SUPERVISOR';

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <PageHeader title="Jobs" right={canCreate ? <HeaderButton icon="add" label="New job" primary onPress={() => router.push('/admin/task-new')} /> : undefined} />
      <Segmented options={FILTERS} value={filter} onChange={setFilter} />
      {data?.tasks.length ? <TaskList tasks={data.tasks} showAssignee /> : null}
      {!loading && !data?.tasks.length ? <EmptyState icon="briefcase-outline" title={earlierShown ? 'No jobs' : 'No jobs today'} message={earlierShown ? 'Nothing matches this filter.' : 'Only jobs created today are listed here.'} /> : null}
      <EarlierJobs count={earlier} onPress={showEarlier} />
    </Screen>
  );
}
