export { useAuthStore } from './authStore';
export type { AuthStore } from './authStore';

export { useSettingsStore } from './settingsStore';
export type { SettingsStore, Theme, Language } from './settingsStore';

import { useAuthStore } from './authStore';
import { useSettingsStore } from './settingsStore';

/**
 * Combined hook that returns both stores' state and actions in one object.
 * Use when a component needs access to both auth and settings simultaneously.
 *
 * @example
 * const { auth, settings } = useAppStore();
 * auth.login('admin', 'secret');
 * settings.setTheme('dark');
 */
export function useAppStore() {
  const auth = useAuthStore();
  const settings = useSettingsStore();
  return { auth, settings };
}
