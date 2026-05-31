/**
 * useInstanceSelector — Manages the active store/instance for CRM and
 * Inventory screens that require an instance_id.
 *
 * Auto-selects the only instance when there is exactly one; otherwise
 * the user must pick via <InstanceSelector />.
 */

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getInstances, Instance } from '../api/instances';
import { useInstanceStore } from '../store/instanceStore';

interface InstanceSelectorResult {
  instances: Instance[];
  selectedInstance: Instance | null;
  selectedId: string | null;
  selectedName: string | null;
  selectInstance: (id: string, name: string) => void;
  isLoading: boolean;
}

export function useInstanceSelector(): InstanceSelectorResult {
  const { selectedId, selectedName, instances, setSelected, setInstances, loadFromStorage } =
    useInstanceStore();

  // Load persisted selection from MMKV on first render
  useEffect(() => {
    loadFromStorage();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch instance list
  const { data, isLoading } = useQuery({
    queryKey: ['instances', 'all'],
    queryFn: () => getInstances({ limit: 200 }),
    staleTime: 5 * 60 * 1000,
  });

  const fetchedInstances: Instance[] = data?.data ?? [];

  // Keep the store in sync with the latest API data
  useEffect(() => {
    if (fetchedInstances.length > 0) {
      setInstances(fetchedInstances);
    }
  }, [fetchedInstances, setInstances]);

  // Auto-select when there is exactly one instance
  useEffect(() => {
    if (fetchedInstances.length === 1 && !selectedId) {
      const only = fetchedInstances[0];
      setSelected(only.id, only.name);
    }
  }, [fetchedInstances, selectedId, setSelected]);

  const list = instances.length > 0 ? instances : fetchedInstances;

  const selectedInstance: Instance | null =
    selectedId ? (list.find(i => i.id === selectedId) ?? null) : null;

  return {
    instances: list,
    selectedInstance,
    selectedId,
    selectedName,
    selectInstance: setSelected,
    isLoading,
  };
}
