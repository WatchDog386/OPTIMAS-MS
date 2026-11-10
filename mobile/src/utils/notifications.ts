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

type IconName = keyof typeof Ionicons.glyphMap;
/** The colour family of a notification's icon tile. */
export type NoteTone = 'success' | 'warning' | 'danger' | 'info' | 'chat' | 'neutral';
type Look = { icon: IconName; tone: NoteTone };

/** Activity alerts: what someone did, matched on the alert's wording (see backend lib/activity.ts). */
const ACTIVITY_LOOKS: [RegExp, Look][] = [
  [/checked in/i, { icon: 'log-in', tone: 'success' }],
  [/checked out/i, { icon: 'log-out', tone: 'info' }],
  [/office location/i, { icon: 'business', tone: 'info' }],
  [/reviewed a check-in photo/i, { icon: 'camera', tone: 'info' }],
  [/reviewed a check-out/i, { icon: 'log-out', tone: 'info' }],
  [/created (job|task)/i, { icon: 'add-circle', tone: 'info' }],
  [/updated (job|task)/i, { icon: 'create', tone: 'info' }],
  [/moved (job|task)|to another technician/i, { icon: 'git-branch', tone: 'info' }],
  [/cancelled (job|task)/i, { icon: 'close-circle', tone: 'danger' }],
  [/sent back (job|task)/i, { icon: 'arrow-undo-circle', tone: 'danger' }],
  [/verified (job|task)/i, { icon: 'shield-checkmark', tone: 'success' }],
  [/started (job|task)/i, { icon: 'play-circle', tone: 'warning' }],
  [/finished (job|task)/i, { icon: 'checkmark-done-circle', tone: 'success' }],
  [/approved items in bulk/i, { icon: 'checkmark-done', tone: 'success' }],
  [/team/i, { icon: 'people', tone: 'info' }],
  [/added an account|onboarded a customer/i, { icon: 'person-add', tone: 'info' }],
  [/reset someone's password/i, { icon: 'key', tone: 'warning' }],
  [/updated an account/i, { icon: 'person', tone: 'info' }],
  [/received stock/i, { icon: 'download', tone: 'info' }],
  [/issued stock/i, { icon: 'arrow-redo', tone: 'info' }],
  [/confirmed receiving/i, { icon: 'checkmark-circle', tone: 'success' }],
  [/returned stock/i, { icon: 'return-down-back', tone: 'info' }],
  [/device installed/i, { icon: 'wifi', tone: 'success' }],
  [/stock count/i, { icon: 'clipboard', tone: 'info' }],
  [/collected a device/i, { icon: 'arrow-undo-circle', tone: 'warning' }],
  [/adjusted store stock/i, { icon: 'options', tone: 'warning' }],
  [/catalogue/i, { icon: 'pricetags', tone: 'info' }],
  [/approved a stock change/i, { icon: 'checkmark-circle', tone: 'success' }],
  [/rejected a stock change/i, { icon: 'close-circle', tone: 'danger' }],
  [/asked for a service visit/i, { icon: 'construct', tone: 'warning' }],
  [/rated a visit/i, { icon: 'star', tone: 'warning' }],
  [/closed a customer request/i, { icon: 'checkmark-circle', tone: 'success' }],
];

/** A stock change, from its summary ("Install …", "Collect …", "Return …"). */
function stockLook(text: string): IconName {
  if (/^install|installed/i.test(text)) return 'wifi';
  if (/^collect/i.test(text)) return 'arrow-undo-circle';
  if (/^return/i.test(text)) return 'return-down-back';
  if (/^issue/i.test(text)) return 'arrow-redo';
  if (/^receive/i.test(text)) return 'download';
  if (/lost/i.test(text)) return 'alert-circle';
  if (/adjust/i.test(text)) return 'options';
  return 'cube';
}

/**
 * The icon and colour that say what a notification is about: by its kind, and for the broad kinds
 * (activity, stock approvals, job updates, customer requests) by what actually happened.
 */
export function notificationLook(n: { type: string; title: string; body?: string }): Look {
  const t = n.title;
  const b = n.body ?? '';
  switch (n.type) {
    case 'ACTIVITY':
      return ACTIVITY_LOOKS.find(([re]) => re.test(t))?.[1] ?? { icon: 'pulse', tone: 'info' };
    case 'STOCK_APPROVAL':
      if (/^approved/i.test(t)) return { icon: 'checkmark-circle', tone: 'success' };
      if (/^not approved/i.test(t)) return { icon: 'close-circle', tone: 'danger' };
      return { icon: stockLook(b), tone: 'warning' };
    case 'TASK_ASSIGNED':
      return /forwarded|moved/i.test(t) ? { icon: 'git-branch', tone: 'info' } : { icon: 'briefcase', tone: /urgent/i.test(t) ? 'danger' : 'info' };
    case 'JOB_UPDATE':
      if (/★/.test(t)) return { icon: 'star', tone: 'warning' };
      if (/started/i.test(t)) return { icon: 'play-circle', tone: 'warning' };
      if (/completed/i.test(t)) return { icon: 'checkmark-done-circle', tone: 'success' };
      if (/reassigned|moved/i.test(t)) return { icon: 'git-branch', tone: 'info' };
      return { icon: 'construct', tone: 'info' };
    case 'SERVICE_REQUEST':
      if (/repair/i.test(t)) return { icon: 'build', tone: 'warning' };
      if (/relocation/i.test(t)) return { icon: 'swap-horizontal', tone: 'warning' };
      if (/installation/i.test(t)) return { icon: 'wifi', tone: 'warning' };
      return { icon: 'help-buoy', tone: 'warning' };
    case 'TASK_COMPLETED':
      return { icon: 'checkmark-done-circle', tone: 'success' };
    case 'TASK_VERIFIED':
      return { icon: 'shield-checkmark', tone: 'success' };
    case 'TASK_REJECTED':
      return { icon: 'arrow-undo-circle', tone: 'danger' };
    case 'TASK_CANCELLED':
      return { icon: 'close-circle', tone: 'danger' };
    case 'STOCK_ISSUED':
      return { icon: 'cube', tone: 'info' };
    case 'DRESS_REJECTED':
      return { icon: 'shirt', tone: 'danger' };
    case 'CHECKOUT_REJECTED':
      return { icon: 'log-out', tone: 'danger' };
    case 'LATE_CHECK_IN':
      return { icon: 'alarm', tone: 'warning' };
    case 'PHOTO_FLAGGED':
      return { icon: /location|away|outside/i.test(t + b) ? 'location' : 'flag', tone: 'warning' };
    case 'STOCK_COUNT_MISMATCH':
      return { icon: 'git-compare', tone: 'danger' };
    case 'UNIT_LOST':
      return { icon: 'alert-circle', tone: 'danger' };
    case 'CHAT_MESSAGE':
      return { icon: 'chatbubble-ellipses', tone: 'chat' };
    case 'APP_UPDATE':
      return { icon: 'rocket', tone: 'success' };
    case 'DAY_REPORT':
      return { icon: 'document-text', tone: 'success' };
    default:
      return { icon: 'notifications', tone: 'neutral' };
  }
}

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
  if (type === 'DAY_REPORT') return typeof data?.dayReportId === 'string' && (role === 'ADMIN' || role === 'SUPERVISOR') ? go(`/admin/day-report/${data.dayReportId}`) : go('/day-report');
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
