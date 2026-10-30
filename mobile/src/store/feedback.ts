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
  /** Playing its exit animation; removed right after. */
  leaving?: boolean;
}

/** A full-screen "well done" moment for the few things worth celebrating (checked in, job completed). */
export interface Celebration {
  id: number;
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
  /** Ask for a line of text (e.g. the reason for a rejection). */
  /** `secret`: a hidden, untrimmed single line (passwords). */
  input?: { placeholder?: string; required?: boolean; secret?: boolean };
}
interface OpenDialog extends DialogSpec {
  resolve: (ok: boolean, value?: string) => void;
}

interface FeedbackState {
  toasts: Toast[];
  dialog: OpenDialog | null;
  celebration: Celebration | null;
  push: (t: Omit<Toast, 'id'>) => void;
  /** Starts the exit animation (tap, swipe or timeout). */
  dismiss: (id: number) => void;
  remove: (id: number) => void;
  celebrate: (title: string, message?: string) => void;
  endCelebration: () => void;
  open: (d: OpenDialog) => void;
  close: (ok: boolean, value?: string) => void;
}

let seq = 0;
const TOAST_MS: Record<ToastKind, number> = { success: 3200, info: 3600, warning: 4200, error: 5200 };

export const useFeedback = create<FeedbackState>((set, get) => ({
  toasts: [],
  dialog: null,
  celebration: null,
  push: (t) => {
    // The same message twice in a row (a retried action) shows once
    if (get().toasts.some((x) => !x.leaving && x.kind === t.kind && x.title === t.title && x.message === t.message)) return;
    const id = ++seq;
    // Newest on top; never stack more than three
    set((s) => ({ toasts: [{ ...t, id }, ...s.toasts].slice(0, 3) }));
    setTimeout(() => get().dismiss(id), TOAST_MS[t.kind]);
  },
  dismiss: (id) => {
    if (!get().toasts.some((t) => t.id === id && !t.leaving)) return;
    set((s) => ({ toasts: s.toasts.map((t) => (t.id === id ? { ...t, leaving: true } : t)) }));
    // The toast animates out first; this is the safety net if it never gets to
    setTimeout(() => get().remove(id), 600);
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  celebrate: (title, message) => set({ celebration: { id: ++seq, title, message } }),
  endCelebration: () => set({ celebration: null }),
  open: (d) => {
    get().dialog?.resolve(false); // a new dialog replaces any open one
    set({ dialog: d });
  },
  close: (ok, value) => {
    const d = get().dialog;
    set({ dialog: null });
    d?.resolve(ok, value);
  },
}));

/** Full-screen success moment with confetti. Use sparingly: checked in, job completed. */
export const celebrate = (title: string, message?: string) => useFeedback.getState().celebrate(title, message);

export const toast = {
  success: (title: string, message?: string) => useFeedback.getState().push({ kind: 'success', title, message }),
  error: (title: string, message?: string) => useFeedback.getState().push({ kind: 'error', title, message }),
  warning: (title: string, message?: string) => useFeedback.getState().push({ kind: 'warning', title, message }),
  info: (title: string, message?: string) => useFeedback.getState().push({ kind: 'info', title, message }),
};

/** Two-button dialog; resolves true when confirmed. */
export const confirmDialog = (spec: DialogSpec) =>
  new Promise<boolean>((resolve) => useFeedback.getState().open({ cancelLabel: 'Cancel', confirmLabel: 'OK', ...spec, resolve }));

/** Dialog with a text box; resolves the text, or null when cancelled. */
export const promptDialog = (spec: DialogSpec) =>
  new Promise<string | null>((resolve) =>
    useFeedback.getState().open({ cancelLabel: 'Cancel', confirmLabel: 'OK', input: {}, ...spec, resolve: (ok, value) => resolve(ok ? (spec.input?.secret ? (value ?? '') : (value ?? '').trim()) : null) }),
  );

/** One-button message dialog. */
export const alertDialog = (spec: Omit<DialogSpec, 'cancelLabel' | 'tone'>) =>
  new Promise<void>((resolve) => useFeedback.getState().open({ confirmLabel: 'OK', ...spec, cancelLabel: null, resolve: () => resolve() }));
