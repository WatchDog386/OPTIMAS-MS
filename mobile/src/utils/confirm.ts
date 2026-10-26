import { alertDialog, confirmDialog } from '../store/feedback';

/** Confirmation in the app's own dialog (destructive style: sign out, cancel, deactivate, archive…). */
export function confirmAction(title: string, message: string, confirmLabel: string): Promise<boolean> {
  return confirmDialog({ title, message, confirmLabel, tone: 'danger' });
}

/** Simple message in the app's own dialog. */
export function notice(title: string, message: string) {
  return alertDialog({ title, message });
}
