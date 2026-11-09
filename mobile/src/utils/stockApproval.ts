import { toast } from '../store/feedback';

/** A stock change that went to the admin instead of happening now. */
export type Pending = { pending: true; request: { id: string; summary: string } };

/** Whether the answer is "sent for approval" (the server answered 202). */
export const isPending = (r: unknown): r is Pending => !!r && typeof r === 'object' && (r as { pending?: boolean }).pending === true;

/** Says the change is waiting for the admin; nothing moves until it is approved. */
export function toastPending(r: Pending) {
  toast.success('Sent for approval', `${r.request.summary}. Nothing moves until an admin approves.`);
}
