import { attachPersistence, clearApiCache } from '../api/cache';
import { create } from 'zustand';
import type { Role, User } from '../api/types';
import { secureStorage } from './storage';

const KEY = 'optimas.session';

interface AuthState {
  token: string | null;
  user: User | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setSession: (token: string, user: User) => Promise<void>;
  logout: () => Promise<void>;
  /** Replace the stored user (e.g. after changing password). */
  updateUser: (user: User) => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  token: null,
  user: null,
  hydrated: false,
  hydrate: async () => {
    try {
      const raw = await secureStorage.get(KEY);
      if (raw) {
        const { token, user } = JSON.parse(raw) as { token: string; user: User };
        // Saved work data first, so screens opened with no signal still have something to show
        if (user.role === 'TECHNICIAN') await (await import('../offline/prefetch')).restoreOfflineCache(user.id);
        set({ token, user });
      }
    } finally {
      set({ hydrated: true });
    }
  },
  setSession: async (token, user) => {
    if (user.role === 'TECHNICIAN') await (await import('../offline/prefetch')).restoreOfflineCache(user.id);
    set({ token, user });
    await secureStorage.set(KEY, JSON.stringify({ token, user }));
  },
  updateUser: async (user) => {
    const token = useAuth.getState().token;
    set({ user });
    if (token) await secureStorage.set(KEY, JSON.stringify({ token, user }));
  },
  logout: async () => {
    clearApiCache();
    attachPersistence(null);
    set({ token: null, user: null });
    await secureStorage.remove(KEY);
  },
}));

export const isManager = (role?: Role) => role === 'ADMIN' || role === 'SUPERVISOR' || role === 'STOREKEEPER';
export const isCustomer = (role?: Role) => role === 'CUSTOMER';

export const isCare = (role?: Role) => role === 'CUSTOMER_CARE';

/** Landing route for each kind of user. */
export const homeFor = (role?: Role) => (role === 'CUSTOMER' ? '/portal' : role === 'CUSTOMER_CARE' ? '/care' : isManager(role) ? '/overview' : '/home');

/** Where to go right after signing in: a forced password change comes first. */
export const afterLogin = (user: User) => (user.mustChangePassword ? '/change-password?forced=1' : homeFor(user.role));
