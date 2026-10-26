import type { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors } from '../theme';
import { useAuth } from '../store/auth';

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

export const notificationStyle: Record<string, { icon: keyof typeof Ionicons.glyphMap; tint: string }> = {
  TASK_ASSIGNED: { icon: 'briefcase', tint: colors.primary },
  TASK_COMPLETED: { icon: 'checkmark-done', tint: colors.accent },
  TASK_VERIFIED: { icon: 'shield-checkmark', tint: colors.success },
  TASK_REJECTED: { icon: 'arrow-undo', tint: colors.danger },
  TASK_CANCELLED: { icon: 'close-circle', tint: colors.textMuted },
  STOCK_ISSUED: { icon: 'cube', tint: colors.warning },
  DRESS_REJECTED: { icon: 'shirt', tint: colors.danger },
  LATE_CHECK_IN: { icon: 'alarm', tint: colors.warning },
  PHOTO_FLAGGED: { icon: 'location', tint: colors.warning },
  STOCK_COUNT_MISMATCH: { icon: 'git-compare', tint: colors.danger },
  UNIT_LOST: { icon: 'warning', tint: colors.danger },
  SERVICE_REQUEST: { icon: 'chatbubbles', tint: colors.info },
  JOB_UPDATE: { icon: 'construct', tint: colors.success },
};

/** Where tapping a notification (in the inbox or from a push) should take the user. */
export function openNotificationTarget(type: string, data?: Record<string, unknown> | null) {
  const customer = useAuth.getState().user?.role === 'CUSTOMER';
  if (customer) {
    if (typeof data?.taskId === 'string') return router.push(`/visit/${data.taskId}`);
    return router.push('/requests');
  }
  if (type === 'SERVICE_REQUEST') return router.push('/admin/requests');
  if (typeof data?.taskId === 'string') return router.push(`/task/${data.taskId}`);
  if (type === 'STOCK_ISSUED') return router.push('/stock');
  if (type === 'LATE_CHECK_IN' || type === 'PHOTO_FLAGGED') return router.push('/admin/attendance');
  if (type === 'STOCK_COUNT_MISMATCH') return router.push('/admin/reconciliation');
  if (type === 'UNIT_LOST' && typeof data?.serialNumber === 'string') return router.push(`/admin/unit?serial=${data.serialNumber}`);
  router.push('/notifications');
}

export const ago = (iso: string) => {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const h = Math.round(mins / 60);
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
};
