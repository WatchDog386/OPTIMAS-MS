import { router } from 'expo-router';
import { api, ApiError } from '../api/client';
import { confirmDialog, promptDialog, toast } from '../store/feedback';
import { requestScan } from '../store/bridge';
import { isPending, toastPending } from './stockApproval';

/**
 * Taking a device back from a customer (relocation, disconnection, faulty swap): scan it, say why, say
 * whether it works. It comes into your stock, to hand back to the store. Resolves true when done.
 */
export async function collectDevice(): Promise<boolean> {
  const scanned = await requestScan({ title: 'Scan the device you are taking back' });
  const code = scanned?.[0];
  if (!code) return false;
  const reason = await promptDialog({ title: 'Why are you taking it?', message: 'For example: customer relocating, disconnected, or swapped for a new one.', emoji: '📦', confirmLabel: 'Next', input: { placeholder: 'Reason', required: true } });
  if (!reason) return false;
  const working = await confirmDialog({ title: 'Is the device working?', message: 'Faulty devices are kept apart when you hand them to the store.', emoji: '🔌', confirmLabel: 'Yes, working', cancelLabel: 'No, faulty' });
  try {
    const r = await api<{ serial: string }>('/inventory/recover', { body: { code, reason, condition: working ? 'GOOD' : 'FAULTY' } });
    if (isPending(r)) toastPending(r);
    else toast.success('Device collected', `${r.serial} is now in your stock. Hand it to the store.`);
    return true;
  } catch (e) {
    toast.error('Not collected', e instanceof ApiError ? e.message : 'Try again');
    return false;
  }
}

/**
 * A device the technician installed but that is still listed as "in hand" (no job, or the job was closed
 * without it): opens the Install page, where they pick the device or TYPE its SN (scanning often picked up
 * the MAC address by mistake), say where it went and add comments, for an admin to approve.
 */
export async function markInstalled(serial?: string): Promise<boolean> {
  router.push((serial ? `/install?serial=${encodeURIComponent(serial)}` : '/install') as never);
  return false;
}
