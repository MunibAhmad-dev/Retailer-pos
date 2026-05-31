import { create } from 'zustand';
import { storage } from '../utils/storage';

const DEFAULT_BACKEND_URL = 'https://osatechcloud.cloud';

export type Theme = 'dark' | 'light' | 'system';
export type Language = 'en' | 'ur';

interface SettingsState {
  theme: Theme;
  language: Language;
  biometricEnabled: boolean;
  pinEnabled: boolean;
  backendUrl: string;
  notificationsEnabled: boolean;
}

interface SettingsActions {
  setTheme: (theme: Theme) => void;
  setLanguage: (language: Language) => void;
  toggleBiometric: () => void;
  togglePin: () => void;
  setBackendUrl: (url: string) => void;
  toggleNotifications: () => void;
}

export type SettingsStore = SettingsState & SettingsActions;

// ── Persistence helpers ───────────────────────────────────────────────────────
const KEYS = {
  theme: 'settings_theme',
  language: 'settings_language',
  biometricEnabled: 'settings_biometric',
  pinEnabled: 'settings_pin',
  backendUrl: 'backend_url',
  notificationsEnabled: 'settings_notifications',
} as const;

function loadInitialState(): SettingsState {
  return {
    theme: (storage.get<Theme>(KEYS.theme)) ?? 'dark',
    language: (storage.get<Language>(KEYS.language)) ?? 'en',
    biometricEnabled: (storage.get<boolean>(KEYS.biometricEnabled)) ?? false,
    pinEnabled: (storage.get<boolean>(KEYS.pinEnabled)) ?? false,
    backendUrl: (storage.get<string>(KEYS.backendUrl)) ?? DEFAULT_BACKEND_URL,
    notificationsEnabled: (storage.get<boolean>(KEYS.notificationsEnabled)) ?? true,
  };
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  // ─── Initial state loaded from MMKV ─────────────────────────────────────
  ...loadInitialState(),

  // ─── Actions ────────────────────────────────────────────────────────────
  setTheme: (theme) => {
    storage.set(KEYS.theme, theme);
    set({ theme });
  },

  setLanguage: (language) => {
    storage.set(KEYS.language, language);
    set({ language });
  },

  toggleBiometric: () => {
    const next = !get().biometricEnabled;
    storage.set(KEYS.biometricEnabled, next);
    set({ biometricEnabled: next });
  },

  togglePin: () => {
    const next = !get().pinEnabled;
    storage.set(KEYS.pinEnabled, next);
    set({ pinEnabled: next });
  },

  setBackendUrl: (url) => {
    const trimmed = url.trim().replace(/\/$/, '');
    storage.set(KEYS.backendUrl, trimmed);
    set({ backendUrl: trimmed });
  },

  toggleNotifications: () => {
    const next = !get().notificationsEnabled;
    storage.set(KEYS.notificationsEnabled, next);
    set({ notificationsEnabled: next });
  },
}));
