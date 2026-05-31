/**
 * AppNavigator.tsx — Root navigator gate
 *
 * Flow:
 *   1. App mounts → SplashScreen renders immediately
 *   2. authStore.loadFromStorage() runs (reads MMKV, validates token with server)
 *   3. Once resolved, SplashScreen plays its 320 ms fade-out, then we swap:
 *        isAuthenticated → MainNavigator
 *        !isAuthenticated → AuthStack
 *
 * Also listens for 'logout' events emitted by the axios 401 interceptor
 * so that any in-flight request that gets a 401 forces an immediate sign-out
 * without requiring the user to take any action.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';

import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/authStore';
import { authEvents } from '@/api/client';

import SplashScreen from '@/screens/auth/SplashScreen';
import AuthStack from './AuthStack';
import MainNavigator from './MainNavigator';

// ---------------------------------------------------------------------------
// AppNavigator
// ---------------------------------------------------------------------------

export default function AppNavigator() {
  /**
   * authResolved: tracks whether loadFromStorage() has finished.
   *   null  = still in progress
   *   true  = finished (success or failure; state is set either way)
   */
  const [authResolved, setAuthResolved] = useState<boolean | null>(null);

  /**
   * showSplash: keeps the SplashScreen mounted until its exit animation ends.
   * Only flipped to false after handleSplashDone fires.
   */
  const [showSplash, setShowSplash] = useState(true);

  // Pull auth state through the hook (granular subscriptions)
  const { isAuthenticated } = useAuth();
  const loadFromStorage = useAuthStore((s) => s.loadFromStorage);

  // Prevent setState after unmount (strict-mode safe)
  const mounted = useRef(true);
  useEffect(() => {
    return () => {
      mounted.current = false;
    };
  }, []);

  // ── Hydrate auth state on mount ────────────────────────────────────────────
  useEffect(() => {
    loadFromStorage().finally(() => {
      if (mounted.current) {
        setAuthResolved(true);
      }
    });
    // loadFromStorage is stable (zustand selector), safe to omit from deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Listen for 401 logout events from the axios interceptor ───────────────
  // authStore already clears its state when this event fires (see authStore.ts),
  // so we only need to react to UI if the splash has already dismissed.
  useEffect(() => {
    const handleLogout = () => {
      // If we're still on the splash, let the normal flow handle it.
      // If we're already in MainNavigator, the state change triggers a re-render
      // and AuthStack is shown automatically — nothing extra needed here.
    };

    authEvents.on('logout', handleLogout);
    return () => {
      authEvents.off('logout', handleLogout);
    };
  }, []);

  // ── Called by SplashScreen after its exit animation finishes ──────────────
  // We only pass onReady once auth has resolved so the splash knows when to
  // begin its exit animation.
  const handleSplashDone = useCallback(() => {
    if (mounted.current) {
      setShowSplash(false);
    }
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────
  if (showSplash) {
    return (
      <SplashScreen
        onReady={authResolved !== null ? handleSplashDone : undefined}
      />
    );
  }

  return isAuthenticated ? <MainNavigator /> : <AuthStack />;
}
