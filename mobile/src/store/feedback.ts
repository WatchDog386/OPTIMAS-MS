import { create } from 'zustand';
import type { Ionicons } from '@expo/vector-icons';

/*
 * The app's own pop-ups: toasts for success / error / info, and confirm / alert dialogs. Replaces the
 * browser's "<site> says" boxes and the system Alert, so every message looks like Optimas MS.
 * Rendered by <FeedbackHost /> in the root layout; call the helpers below from anywhere.
 */

export type ToastKind = 'success' | 'error' | 'warning' | 'info';
export interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  message?: string;
}

export interface DialogSpec {
  title: string;
  message?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  /** 'danger' paints the confirm button red (sign out, cancel job, deactivate…). */
  tone?: 'default' | 'danger';
  confirmLabel?: string;
  /** Omit for a single-button message (alert). */
  cancelLabel?: string | null;
}
interface OpenDialog extends DialogSpec {
  resolve: (ok: boolean) => void;
}

interface FeedbackState {
  toasts: Toast[];
  dialog: OpenDialog | null;
  push: (t: Omit<Toast, 'id'>) => void;
  dismiss: (id: number) => void;
  open: (d: OpenDialog) => void;
  close: (ok: boolean) => void;
}

let seq = 0;
const TOAST_MS: Record<ToastKind, number> = { success: 3200, info: 3600, warning: 4200, error: 5200 };

export const useFeedback = create<FeedbackState>((set, get) => ({
  toasts: [],
  dialog: null,
  push: (t) => {
    const id = ++seq;
    // Newest on top; never stack more than three
    set((s) => ({ toasts: [{ ...t, id }, ...s.toasts].slice(0, 3) }));
    setTimeout(() => get().dismiss(id), TOAST_MS[t.kind]);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  open: (d) => {
    get().dialog?.resolve(false); // a new dialog replaces any open one
    set({ dialog: d });
  },
  close: (ok) => {
    const d = get().dialog;
    set({ dialog: null });
    d?.resolve(ok);
  },
}));

export const toast = {
  success: (title: string, message?: string) => useFeedback.getState().push({ kind: 'success', title, message }),
  error: (title: string, message?: string) => useFeedback.getState().push({ kind: 'error', title, message }),
  warning: (title: string, message?: string) => useFeedback.getState().push({ kind: 'warning', title, message }),
  info: (title: string, message?: string) => useFeedback.getState().push({ kind: 'info', title, message }),
};

/** Two-button dialog; resolves true when confirmed. */
export const confirmDialog = (spec: DialogSpec) =>
  new Promise<boolean>((resolve) => useFeedback.getState().open({ cancelLabel: 'Cancel', confirmLabel: 'OK', ...spec, resolve }));

/** One-button message dialog. */
export const alertDialog = (spec: Omit<DialogSpec, 'cancelLabel' | 'tone'>) =>
  new Promise<void>((resolve) => useFeedback.getState().open({ confirmLabel: 'OK', ...spec, cancelLabel: null, resolve: () => resolve() }));
