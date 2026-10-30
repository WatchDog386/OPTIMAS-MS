import { create } from 'zustand';

/** Screens still waiting for their first data. While any are, the page loader covers the screen. */
export const usePageLoad = create<{ pending: Set<string>; start: (id: string) => void; done: (id: string) => void }>((set) => ({
  pending: new Set(),
  start: (id) =>
    set((s) => {
      if (s.pending.has(id)) return s;
      const pending = new Set(s.pending);
      pending.add(id);
      return { pending };
    }),
  done: (id) =>
    set((s) => {
      if (!s.pending.has(id)) return s;
      const pending = new Set(s.pending);
      pending.delete(id);
      return { pending };
    }),
}));
