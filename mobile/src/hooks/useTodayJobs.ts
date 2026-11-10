import { useState } from 'react';
import type { Task } from '../api/types';
import { useApi } from './useApi';

/**
 * The jobs pages list only jobs created today; older ones stay out of the way behind "Show earlier
 * jobs (N)", for a job from another day that is still open.
 */
export function useTodayJobs(status: string, options?: { poll?: number }) {
  const [earlierShown, setEarlierShown] = useState(false);
  const q = [status ? `status=${status}` : null, earlierShown ? null : 'created=today'].filter(Boolean).join('&');
  const api = useApi<{ tasks: Task[]; earlier?: number }>(`/tasks${q ? `?${q}` : ''}`, options);
  return { ...api, earlier: earlierShown ? 0 : (api.data?.earlier ?? 0), earlierShown, showEarlier: () => setEarlierShown(true) };
}
