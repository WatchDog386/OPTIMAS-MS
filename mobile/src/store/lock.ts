import { create } from 'zustand';

/** Whether the app is behind the fingerprint lock screen right now; `rev` changes when the lock is turned on or off. */
export const useLock = create<{ locked: boolean; rev: number; setLocked: (v: boolean) => void; changed: () => void }>((set) => ({
  locked: false,
  rev: 0,
  setLocked: (locked) => set({ locked }),
  changed: () => set((s) => ({ rev: s.rev + 1 })),
}));
