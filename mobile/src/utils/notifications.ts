import type Ionicons from '@expo/vector-icons/Ionicons';
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
  CHECKOUT_REJECTED: { icon: 'log-out', tint: colors.danger },
  LATE_CHECK_IN: { icon: 'alarm', tint: colors.warning },
  PHOTO_FLAGGED: { icon: 'location', tint: colors.warning },
  STOCK_COUNT_MISMATCH: { icon: 'git-compare', tint: colors.danger },
  UNIT_LOST: { icon: 'warning', tint: colors.danger },
  SERVICE_REQUEST: { icon: 'chatbubbles', tint: colors.info },
  JOB_UPDATE: { icon: 'construct', tint: colors.success },
  CHAT_MESSAGE: { icon: 'chatbubble-ellipses', tint: colors.navy },
  APP_UPDATE: { icon: 'sparkles', tint: colors.success },
  ACTIVITY: { icon: 'pulse', tint: colors.info },
  STOCK_APPROVAL: { icon: 'cube', tint: colors.warning },
};

/**
 * Opens what a notification is about (from the list, the in-app banner, or a phone alert). Returns false
 * when it has no page of its own — the caller then shows the full message instead.
 */
export function openNotificationTarget(type: string, data?: Record<string, unknown> | null): boolean {
  const role = useAuth.getState().user?.role;
  const go = (href: string) => {
    router.push(href as never);
    return true;
  };
  // A new version is live: reloading opens it
  if (type === 'APP_UPDATE' && typeof window !== 'undefined' && window.location) {
    window.location.reload();
    return true;
  }
  if (type === 'CHAT_MESSAGE' && typeof data?.conversationId === 'string') return go(`/chat/${data.conversationId}`);
  if (role === 'CUSTOMER') return typeof data?.taskId === 'string' ? go(`/visit/${data.taskId}`) : go('/requests');
  if (type === 'SERVICE_REQUEST') return go(role === 'CUSTOMER_CARE' ? '/care-requests' : '/admin/requests');
  if (typeof data?.taskId === 'string') return go(`/task/${data.taskId}`);
  if (type === 'STOCK_ISSUED') return go(role === 'TECHNICIAN' ? '/stock' : '/store');
  // A stock change: admins open the Stock approvals; the person who asked sees it in My stock
  if (type === 'STOCK_APPROVAL') return go(role === 'ADMIN' ? '/admin/approvals?tab=stock' : role === 'TECHNICIAN' ? '/stock' : '/store');
  // Late or flagged check-ins open straight on the review desk, where the photo can be approved
  if (type === 'LATE_CHECK_IN' || type === 'PHOTO_FLAGGED') return go('/admin/approvals?tab=checkins');
  // A technician's own check-in or check-out sent back: their attendance history
  if (type === 'DRESS_REJECTED' || type === 'CHECKOUT_REJECTED') return go(role === 'TECHNICIAN' ? '/profile' : '/more');
  if (type === 'STOCK_COUNT_MISMATCH') return go('/admin/reconciliation');
  if (type === 'UNIT_LOST' && typeof data?.serialNumber === 'string') return go(`/admin/unit?serial=${encodeURIComponent(data.serialNumber)}`);
  // Something someone did: the activity timeline (office staff)
  if (type === 'ACTIVITY' && (role === 'ADMIN' || role === 'SUPERVISOR')) return go('/admin/activity');
  return false;
}

export const ago = (iso: string) => {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const h = Math.round(mins / 60);
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
};
