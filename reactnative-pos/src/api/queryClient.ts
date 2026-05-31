/**
 * queryClient.ts — TanStack Query v5 configuration with MMKV persistence.
 *
 * Usage:
 *   import { QueryClientWrapper } from '@/api/queryClient';
 *   // Wrap your app root with <QueryClientWrapper>
 */

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { persistQueryClient } from '@tanstack/query-persist-client-core';
import { mmkv } from '../utils/storage';

// ─── MMKV persister ───────────────────────────────────────────────────────────

const CACHE_KEY = 'rq_cache';

const mmkvPersister = {
  persistClient: async (client: unknown) => {
    try {
      mmkv.set(CACHE_KEY, JSON.stringify(client));
    } catch {
      // Ignore serialisation errors (e.g. circular refs)
    }
  },
  restoreClient: async () => {
    try {
      const raw = mmkv.getString(CACHE_KEY);
      return raw ? JSON.parse(raw) : undefined;
    } catch {
      return undefined;
    }
  },
  removeClient: async () => {
    mmkv.delete(CACHE_KEY);
  },
};

// ─── QueryClient instance ─────────────────────────────────────────────────────

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,           // 5 minutes
      gcTime: 30 * 60 * 1000,             // 30 minutes
      retry: 3,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000),
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
  },
});

// Attach MMKV persister so cache survives app restarts
persistQueryClient({
  queryClient,
  persister: mmkvPersister,
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
});

// ─── Provider wrapper ─────────────────────────────────────────────────────────

interface QueryClientWrapperProps {
  children: React.ReactNode;
}

export function QueryClientWrapper({ children }: QueryClientWrapperProps) {
  return React.createElement(
    QueryClientProvider,
    { client: queryClient },
    children,
  );
}
