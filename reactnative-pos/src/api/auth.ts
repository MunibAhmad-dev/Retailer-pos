import { get, post } from './client';
import { mmkv } from '../utils/storage';

export interface AdminUser {
  id: number;
  username: string;
  email?: string;
  role: string;
  created_at?: string;
}

export interface LoginResponse {
  token: string;
  user: AdminUser;
}

/**
 * Authenticate with username + password.
 * Returns token and user info (does NOT persist — store handles that).
 */
export async function login(username: string, password: string): Promise<LoginResponse> {
  const response = await post<{ success: boolean; token: string; user?: AdminUser }>(
    '/api/auth/login',
    { username, password },
  );

  const token = response.token;
  // GET /auth/me to hydrate user if the login response doesn't include it
  if (!response.user) {
    mmkv.set('admin_token', token);
    const user = await getMe();
    return { token, user };
  }

  return { token, user: response.user };
}

/**
 * Fetch the currently authenticated admin user.
 */
export async function getMe(): Promise<AdminUser> {
  return get<AdminUser>('/api/auth/me');
}

/**
 * Clear the stored JWT. Navigation back to login is handled by the auth store.
 */
export function logout(): void {
  mmkv.delete('admin_token');
  mmkv.delete('admin_user');
}
