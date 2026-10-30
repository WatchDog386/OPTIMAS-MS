import { create } from 'zustand';

/** Whether the app is behind the fingerprint lock screen right now; `rev` changes when the lock is turned on or off. */
export const useLock = create<{ locked: boolean; rev: number; setLocked: (v: boolean) => void; changed: () => void }>((set) => ({
  locked: false,
  rev: 0,
  setLocked: (locked) => set({ locked }),
  changed: () => set((s) => ({ rev: s.rev + 1 })),
}));

/**
 * Leaving the app on purpose for a moment (the phone's camera for a photo or a scan): the lock does not
 * kick in while that is open. Ends when the person is back.
 */
let excusedUntil = 0;
export const excuseLeaving = (ms = 3 * 60_000) => {
  excusedUntil = Date.now() + ms;
};
export const leavingExcused = () => Date.now() < excusedUntil;
export const endExcuse = () => {
  excusedUntil = 0;
};
