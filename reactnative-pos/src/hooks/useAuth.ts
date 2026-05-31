import { useCallback } from 'react';
import { useAuthStore } from '../store/authStore';

/**
 * Convenience hook over authStore.
 * Returns { user, isAuthenticated, isLoading, error, login, logout }.
 */
export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const error = useAuthStore((s) => s.error);
  const storeLogin = useAuthStore((s) => s.login);
  const storeLogout = useAuthStore((s) => s.logout);

  const login = useCallback(
    (username: string, password: string) => storeLogin(username, password),
    [storeLogin],
  );

  const logout = useCallback(() => storeLogout(), [storeLogout]);

  return { user, isAuthenticated, isLoading, error, login, logout };
}
