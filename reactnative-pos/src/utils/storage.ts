import { MMKV } from 'react-native-mmkv';

export const mmkv = new MMKV({ id: 'osatechpos-storage' });

export const storage = {
  get<T>(key: string): T | null {
    const raw = mmkv.getString(key);
    if (raw === undefined) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return raw as unknown as T;
    }
  },

  set(key: string, value: unknown): void {
    if (typeof value === 'string') {
      mmkv.set(key, value);
    } else {
      mmkv.set(key, JSON.stringify(value));
    }
  },

  remove(key: string): void {
    mmkv.delete(key);
  },

  clear(): void {
    mmkv.clearAll();
  },
};
