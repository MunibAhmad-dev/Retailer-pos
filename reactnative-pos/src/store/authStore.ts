import { create } from 'zustand';
import { login as apiLogin, logout as apiLogout, getMe, AdminUser } from '../api/auth';
import { storage } from '../utils/storage';
import { authEvents } from '../api/client';

const TOKEN_KEY = 'admin_token';
const USER_KEY = 'admin_user';

interface AuthState {
  user: AdminUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

interface AuthActions {
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  loadFromStorage: () => Promise<void>;
  setUser: (user: AdminUser) => void;
}

export type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>((set, get) => {
  // Listen for 401 logout events emitted by the axios interceptor
  authEvents.on('logout', () => {
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      error: null,
    });
    storage.remove(TOKEN_KEY);
    storage.remove(USER_KEY);
  });

  return {
    // ─── State ───────────────────────────────────────────────────────────────
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,

    // ─── Actions ─────────────────────────────────────────────────────────────
    login: async (username, password) => {
      set({ isLoading: true, error: null });
      try {
        const { token, user } = await apiLogin(username, password);
        storage.set(TOKEN_KEY, token);
        storage.set(USER_KEY, user);
        set({ token, user, isAuthenticated: true, isLoading: false });
      } catch (err: unknown) {
        const message =
          (err as { response?: { data?: { message?: string } } })?.response?.data
            ?.message ?? 'Login failed. Please check your credentials.';
        set({ isLoading: false, error: message });
        throw err;
      }
    },

    logout: () => {
      apiLogout();
      set({ user: null, token: null, isAuthenticated: false, error: null });
    },

    loadFromStorage: async () => {
      set({ isLoading: true });
      try {
        const token = storage.get<string>(TOKEN_KEY);
        const cachedUser = storage.get<AdminUser>(USER_KEY);

        if (!token) {
          set({ isLoading: false });
          return;
        }

        // Optimistically set state from cache so app renders immediately
        set({ token, user: cachedUser, isAuthenticated: true });

        // Re-validate token with server in background
        const freshUser = await getMe();
        storage.set(USER_KEY, freshUser);
        set({ user: freshUser, isLoading: false });
      } catch {
        // Token invalid — clear everything
        storage.remove(TOKEN_KEY);
        storage.remove(USER_KEY);
        set({ user: null, token: null, isAuthenticated: false, isLoading: false });
      }
    },

    setUser: (user) => {
      storage.set(USER_KEY, user);
      set({ user });
    },
  };
});
