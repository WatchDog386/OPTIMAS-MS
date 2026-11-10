import { useState } from 'react';
import type { Task } from '../api/types';
import { useApi } from './useApi';

/**
 * The jobs pages list only jobs created today; older ones stay out of the way behind "Show earlier
 * jobs (N)", for a job from another day that is still open.
 */
export function useTodayJobs(status: string, options?: { poll?: number; due?: 'soon' | 'overdue' }) {
  const [earlierShown, setEarlierShown] = useState(false);
  // Due soon / overdue (the overview's tiles) are about open tasks from any day
  const due = options?.due;
  const q = [status ? `status=${status}` : null, due ? `due=${due}` : earlierShown ? null : 'created=today'].filter(Boolean).join('&');
  const api = useApi<{ tasks: Task[]; earlier?: number }>(`/tasks${q ? `?${q}` : ''}`, options);
  return { ...api, earlier: earlierShown || due ? 0 : (api.data?.earlier ?? 0), earlierShown: earlierShown || !!due, showEarlier: () => setEarlierShown(true) };
}
