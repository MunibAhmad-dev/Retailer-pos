/**
 * instanceStore — Zustand store for the active store/instance selection.
 * State is persisted to MMKV so the selection survives app restarts.
 */

import { create } from 'zustand';
import { storage } from '../utils/storage';
import { Instance } from '../api/instances';

const SELECTED_ID_KEY = 'selected_instance_id';
const SELECTED_NAME_KEY = 'selected_instance_name';

// ─── Types ────────────────────────────────────────────────────────────────────

interface InstanceState {
  selectedId: string | null;
  selectedName: string | null;
  instances: Instance[];
}

interface InstanceActions {
  setSelected: (id: string, name: string) => void;
  clearSelected: () => void;
  setInstances: (instances: Instance[]) => void;
  loadFromStorage: () => void;
}

export type InstanceStore = InstanceState & InstanceActions;

// ─── Store ────────────────────────────────────────────────────────────────────

export const useInstanceStore = create<InstanceStore>((set) => ({
  // ─── Initial state ───────────────────────────────────────────────────────
  selectedId: null,
  selectedName: null,
  instances: [],

  // ─── Actions ─────────────────────────────────────────────────────────────
  setSelected: (id, name) => {
    storage.set(SELECTED_ID_KEY, id);
    storage.set(SELECTED_NAME_KEY, name);
    set({ selectedId: id, selectedName: name });
  },

  clearSelected: () => {
    storage.remove(SELECTED_ID_KEY);
    storage.remove(SELECTED_NAME_KEY);
    set({ selectedId: null, selectedName: null });
  },

  setInstances: (instances) => {
    set({ instances });
  },

  loadFromStorage: () => {
    const id = storage.get<string>(SELECTED_ID_KEY);
    const name = storage.get<string>(SELECTED_NAME_KEY);
    if (id && name) {
      set({ selectedId: id, selectedName: name });
    }
  },
}));
