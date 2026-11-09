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
 * A device the technician installed but that is still listed as "in hand" (for example the job was
 * closed without it): the technician TYPES the serial number (SN) from the sticker — scanning often picked
 * up the MAC address by mistake — or taps the device in My stock, gives the customer's account, and the
 * install goes to an admin for approval. Resolves true when sent.
 */
export async function markInstalled(serial?: string): Promise<boolean> {
  let code = serial;
  if (!code) {
    code =
      (await promptDialog({
        title: 'Serial number (SN)',
        message: 'Type the SN exactly as printed on the sticker, next to "SN". Not the MAC address.',
        emoji: '🔢',
        confirmLabel: 'Next',
        input: { placeholder: 'e.g. HWTC1A2B3C4D', required: true },
      })) ?? undefined;
  }
  if (!code) return false;
  let unit: { serialNumber: string; item: { name: string } };
  try {
    unit = (await api<{ unit: typeof unit }>(`/inventory/my/find?code=${encodeURIComponent(code.trim().toUpperCase())}`)).unit;
  } catch (e) {
    toast.error('Not one of your devices', e instanceof ApiError ? e.message : 'Check the SN and try again');
    return false;
  }
  const account = await promptDialog({
    title: 'Installed for which customer?',
    message: `${unit.item.name} · S/N ${unit.serialNumber}. Enter the customer's account number.`,
    emoji: '📡',
    confirmLabel: 'Send for approval',
    input: { placeholder: 'Customer account, e.g. FBI-CUS-1234', required: true },
  });
  if (!account) return false;
  try {
    const r = await api('/inventory/install', { body: { serial: unit.serialNumber, customerAccount: account } });
    if (isPending(r)) toastPending(r);
    else toast.success('Marked installed', `${unit.serialNumber} moved from In hand to Installed.`);
    return true;
  } catch (e) {
    toast.error('Not sent', e instanceof ApiError ? e.message : 'Try again');
    return false;
  }
}
