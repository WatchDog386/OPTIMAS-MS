import { useState } from 'react';
import type { Task, TaskStatus } from '../../src/api/types';
import { EmptyState, PageHeader, Reveal, Screen, Segmented, TaskCard } from '../../src/components';
import { useApi } from '../../src/hooks/useApi';

type Show = 'open' | 'done';
const STATUSES: Record<Show, TaskStatus[]> = { open: ['ASSIGNED', 'IN_PROGRESS'], done: ['COMPLETED', 'VERIFIED', 'REJECTED', 'CANCELLED'] };

/** Every job, to answer "where is my technician?": open a job to see it and follow it live. */
export default function CareJobs() {
  const [show, setShow] = useState<Show>('open');
  const { data, refresh, refreshing, loading } = useApi<{ tasks: Task[] }>(`/tasks?status=${STATUSES[show].join(',')}`, { poll: 30_000 });
  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <PageHeader title="Jobs" />
      <Segmented
        options={[
          { value: 'open', label: 'Open' },
          { value: 'done', label: 'Finished' },
        ]}
        value={show}
        onChange={setShow}
      />
      {!loading && !data?.tasks.length ? <EmptyState icon="briefcase-outline" title="No jobs here" message="Jobs the office assigns show up here." /> : null}
      {data?.tasks.map((t, i) => (
        <Reveal key={t.id} index={Math.min(i, 8)}>
          <TaskCard task={t} showAssignee />
        </Reveal>
      ))}
    </Screen>
  );
}
