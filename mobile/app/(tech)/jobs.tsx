import { useState } from 'react';
import { EarlierJobs, EmptyState, PageHeader, Screen, Segmented, TaskList, Text } from '../../src/components';
import { useTodayJobs } from '../../src/hooks/useTodayJobs';
import { colors } from '../../src/theme';

const FILTERS = [
  { value: 'IN_PROGRESS,ASSIGNED', label: 'Active' },
  { value: 'COMPLETED,VERIFIED', label: 'Completed' },
  { value: 'REJECTED', label: 'Returned' },
  { value: '', label: 'All' },
];

export default function Jobs() {
  const [filter, setFilter] = useState(FILTERS[0].value);
  const { data, refreshing, refresh, loading, earlier, earlierShown, showEarlier } = useTodayJobs(filter, { poll: 20_000 });
  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <PageHeader title="My tasks" />
      <Text variant="bodySm" color={colors.textMuted}>
        Take a photo when you start and when you finish every task.
      </Text>
      <Segmented options={FILTERS} value={filter} onChange={setFilter} />
      {data?.tasks.length ? <TaskList tasks={data.tasks} /> : null}
      {!loading && !data?.tasks.length ? <EmptyState icon="briefcase-outline" title={earlierShown ? 'Nothing here' : 'No tasks today'} message={earlierShown ? 'No tasks match this filter.' : 'Only tasks created today are listed here.'} /> : null}
      <EarlierJobs count={earlier} onPress={showEarlier} />
    </Screen>
  );
}
