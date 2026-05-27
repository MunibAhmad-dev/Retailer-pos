import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

export interface ModulesConfig {
  bakery: boolean;
  accounting: boolean;
  expiryTracking: boolean;
  weightSelling: boolean;
}

interface ModulesContextValue {
  modules: ModulesConfig;
  loading: boolean;
  reload: () => Promise<void>;
}

const defaultModules: ModulesConfig = {
  bakery: false,
  accounting: false,
  expiryTracking: false,
  weightSelling: false,
};

const ModulesContext = createContext<ModulesContextValue>({
  modules: defaultModules,
  loading: true,
  reload: async () => {},
});

export function ModulesProvider({ children }: { children: React.ReactNode }) {
  const [modules, setModules] = useState<ModulesConfig>(defaultModules);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const res = await (window as any).api.getSettings();
      const d = res?.data as any;
      const bakery = !!d?.bakery_module_enabled;
      const accounting = !!d?.accounting_module_enabled;
      setModules({
        bakery,
        accounting,
        expiryTracking: bakery,
        weightSelling: bakery,
      });
    } catch {
      // keep defaults on error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  return (
    <ModulesContext.Provider value={{ modules, loading, reload }}>
      {children}
    </ModulesContext.Provider>
  );
}

export function useModules() {
  return useContext(ModulesContext);
}
