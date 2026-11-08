import { create } from 'zustand';

/** Screens still waiting for their first data. While any are, the page loader covers the screen. */
export const usePageLoad = create<{
  pending: Set<string>;
  /** When a page last came on screen (a page's data hook or Screen reports it), for the page-change loader. */
  shownAt: number;
  shown: () => void;
  start: (id: string) => void;
  done: (id: string) => void;
}>((set) => ({
  pending: new Set(),
  shownAt: 0,
  shown: () => set({ shownAt: Date.now() }),
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

/**
 * A page's code arriving counts as loading too: on the web each page's code is its own file, added as a
 * <script> when the page is first opened. Without this the loader went away while that file was still
 * downloading, leaving a blank page. The script counts until it has run and the page has had a moment
 * to start fetching its data.
 */
if (typeof document !== 'undefined' && typeof MutationObserver !== 'undefined' && document.head) {
  let n = 0;
  const track = (el: HTMLScriptElement) => {
    if (!el.src || !el.src.includes('/_expo/static/js/')) return;
    const id = `script-${(n += 1)}`;
    usePageLoad.getState().start(id);
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      // Let the page render and start its data request (which keeps the loader up) before letting go
      requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(() => usePageLoad.getState().done(id), 150)));
    };
    el.addEventListener('load', finish);
    el.addEventListener('error', finish);
    setTimeout(finish, 30_000);
  };
  new MutationObserver((list) => {
    for (const m of list) m.addedNodes.forEach((node) => node instanceof HTMLScriptElement && track(node));
  }).observe(document.head, { childList: true });
}
