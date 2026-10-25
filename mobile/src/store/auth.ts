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
        set({ token, user });
      }
    } finally {
      set({ hydrated: true });
    }
  },
  setSession: async (token, user) => {
    set({ token, user });
    await secureStorage.set(KEY, JSON.stringify({ token, user }));
  },
  logout: async () => {
    set({ token: null, user: null });
    await secureStorage.remove(KEY);
  },
}));

export const isManager = (role?: Role) => role === 'ADMIN' || role === 'SUPERVISOR' || role === 'STOREKEEPER';
