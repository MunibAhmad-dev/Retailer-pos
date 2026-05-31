/**
 * useOfflineSync — Monitors network state and invalidates stale queries
 * when connectivity is restored.
 */

import { useEffect, useRef, useState } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';

interface OfflineSyncState {
  isOnline: boolean;
  wasOffline: boolean;
  syncPending: boolean;
}

export function useOfflineSync(): OfflineSyncState {
  const queryClient = useQueryClient();

  const [state, setState] = useState<OfflineSyncState>({
    isOnline: true,
    wasOffline: false,
    syncPending: false,
  });

  // Track previous online status so we can detect the offline→online transition
  const wasOnlineRef = useRef(true);
  // Prevent invalidation from running multiple times during rapid reconnects
  const syncingRef = useRef(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(async (netState: NetInfoState) => {
      const nowOnline = netState.isConnected === true && netState.isInternetReachable !== false;
      const prevOnline = wasOnlineRef.current;

      wasOnlineRef.current = nowOnline;

      if (!nowOnline && prevOnline) {
        // Just went offline
        setState(prev => ({ ...prev, isOnline: false, wasOffline: true, syncPending: true }));
        Toast.show({
          type: 'error',
          text1: 'No Internet Connection',
          text2: 'Working offline. Data may be outdated.',
          visibilityTime: 3000,
        });
        return;
      }

      if (nowOnline && !prevOnline) {
        // Just came back online
        setState(prev => ({ ...prev, isOnline: true, syncPending: false }));
        Toast.show({
          type: 'success',
          text1: 'Back Online',
          text2: 'Syncing latest data...',
          visibilityTime: 2000,
        });

        if (!syncingRef.current) {
          syncingRef.current = true;
          try {
            // Invalidate all queries so stale data is refreshed
            await queryClient.invalidateQueries();
          } finally {
            syncingRef.current = false;
          }
        }
        return;
      }

      // Normal update — just keep isOnline in sync
      setState(prev => ({ ...prev, isOnline: nowOnline }));
    });

    // Fetch the current connection state on mount
    NetInfo.fetch().then((netState: NetInfoState) => {
      const online = netState.isConnected === true && netState.isInternetReachable !== false;
      wasOnlineRef.current = online;
      setState(prev => ({ ...prev, isOnline: online }));
    });

    return () => {
      unsubscribe();
    };
  }, [queryClient]);

  return state;
}
