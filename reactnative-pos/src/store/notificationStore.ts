import { create } from 'zustand';
import { mmkv } from '../utils/storage';
import { get as apiGet } from '../api/client';

const STORAGE_KEY = 'app_notifications';
const MAX_NOTIFICATIONS = 100;

export interface AppNotification {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success' | 'license' | 'update';
  title: string;
  body: string;
  read: boolean;
  timestamp: string;
  data?: Record<string, unknown>;
}

interface NotificationState {
  notifications: AppNotification[];
  unreadCount: number;
  badgeCount: number;
}

interface NotificationActions {
  addNotification: (notification: Omit<AppNotification, 'id' | 'read' | 'timestamp'>) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clearAll: () => void;
  setFromApi: () => Promise<void>;
}

export type NotificationStore = NotificationState & NotificationActions;

// ── Persistence helpers ───────────────────────────────────────────────────────

function loadFromStorage(): AppNotification[] {
  const raw = mmkv.getString(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as AppNotification[];
  } catch {
    return [];
  }
}

function saveToStorage(notifications: AppNotification[]): void {
  mmkv.set(STORAGE_KEY, JSON.stringify(notifications));
}

function computeCounts(notifications: AppNotification[]): {
  unreadCount: number;
  badgeCount: number;
} {
  const unreadCount = notifications.filter((n) => !n.read).length;
  return { unreadCount, badgeCount: unreadCount };
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ── Store ─────────────────────────────────────────────────────────────────────

const initialNotifications = loadFromStorage();

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  // ─── State ────────────────────────────────────────────────────────────────
  notifications: initialNotifications,
  ...computeCounts(initialNotifications),

  // ─── Actions ──────────────────────────────────────────────────────────────

  addNotification: (notification) => {
    const newItem: AppNotification = {
      ...notification,
      id: generateId(),
      read: false,
      timestamp: new Date().toISOString(),
    };

    // Prepend and cap at MAX_NOTIFICATIONS
    const updated = [newItem, ...get().notifications].slice(0, MAX_NOTIFICATIONS);
    saveToStorage(updated);
    set({ notifications: updated, ...computeCounts(updated) });
  },

  markRead: (id) => {
    const updated = get().notifications.map((n) =>
      n.id === id ? { ...n, read: true } : n,
    );
    saveToStorage(updated);
    set({ notifications: updated, ...computeCounts(updated) });
  },

  markAllRead: () => {
    const updated = get().notifications.map((n) => ({ ...n, read: true }));
    saveToStorage(updated);
    set({ notifications: updated, unreadCount: 0, badgeCount: 0 });
  },

  clearAll: () => {
    mmkv.delete(STORAGE_KEY);
    set({ notifications: [], unreadCount: 0, badgeCount: 0 });
  },

  setFromApi: async () => {
    try {
      const apiItems = await apiGet<AppNotification[]>('/api/admin/notifications');
      if (!Array.isArray(apiItems)) return;

      // Merge: keep local read-state for items already present, add new ones
      const existingMap = new Map(get().notifications.map((n) => [n.id, n]));
      const merged = apiItems.map((item) => {
        const existing = existingMap.get(item.id);
        return existing ? { ...item, read: existing.read } : item;
      });

      // Prepend any purely local items that didn't come from the API
      const apiIds = new Set(apiItems.map((n) => n.id));
      const localOnly = get().notifications.filter((n) => !apiIds.has(n.id));
      const updated = [...localOnly, ...merged].slice(0, MAX_NOTIFICATIONS);

      saveToStorage(updated);
      set({ notifications: updated, ...computeCounts(updated) });
    } catch {
      // Silently fail — keep existing notifications
    }
  },
}));
