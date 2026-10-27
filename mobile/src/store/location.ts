import { create } from 'zustand';
import type { Fix } from '../utils/location';

interface LocationState {
  /** Latest position from this phone (only while sharing or navigating). */
  fix: Fix | null;
  setFix: (fix: Fix | null) => void;
  /** "Not now" on the location question: asked again at the next sign-in, not before. */
  promptDismissed: boolean;
  dismissPrompt: () => void;
  resetPrompt: () => void;
}

export const useLocation = create<LocationState>((set) => ({
  fix: null,
  setFix: (fix) => set({ fix }),
  promptDismissed: false,
  dismissPrompt: () => set({ promptDismissed: true }),
  resetPrompt: () => set({ promptDismissed: false }),
}));
