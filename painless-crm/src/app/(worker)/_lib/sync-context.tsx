'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { type QueueCounts, type QueuedAction, enqueue, getCounts } from './offline-queue';
import { drainQueue } from './sync';

// Shared sync state for the worker app: queue counts, connectivity, last-synced
// time, and the actions that mutate them. Drives the status bar and lets the
// clock-in flow enqueue + trigger a sync. Sync triggers (ADR-011): mount, online
// event, tab becoming visible, a 60s timer, and the manual "Sync now" button.

const SYNC_INTERVAL_MS = 60_000;

interface SyncContextValue {
  online: boolean;
  counts: QueueCounts;
  lastSyncedAt: number | null;
  syncing: boolean;
  syncNow: () => Promise<void>;
  enqueueAction: (action: QueuedAction) => Promise<void>;
}

const SyncContext = createContext<SyncContextValue | null>(null);

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const [online, setOnline] = useState(true);
  const [counts, setCounts] = useState<QueueCounts>({ pending: 0, failed: 0 });
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const running = useRef(false);

  const refreshCounts = useCallback(async () => {
    setCounts(await getCounts());
  }, []);

  const syncNow = useCallback(async () => {
    if (running.current || typeof navigator === 'undefined' || !navigator.onLine) {
      await refreshCounts();
      return;
    }
    running.current = true;
    setSyncing(true);
    try {
      const result = await drainQueue(Date.now());
      if (result.succeeded > 0) setLastSyncedAt(Date.now());
    } finally {
      running.current = false;
      setSyncing(false);
      await refreshCounts();
    }
  }, [refreshCounts]);

  const enqueueAction = useCallback(
    async (action: QueuedAction) => {
      await enqueue(action);
      await refreshCounts();
      await syncNow();
    },
    [refreshCounts, syncNow],
  );

  useEffect(() => {
    const updateOnline = () => setOnline(navigator.onLine);
    updateOnline();
    void syncNow();

    const onVisible = () => {
      if (document.visibilityState === 'visible') void syncNow();
    };
    const onOnline = () => {
      setOnline(true);
      void syncNow();
    };
    const onOffline = () => setOnline(false);

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(() => void syncNow(), SYNC_INTERVAL_MS);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(timer);
    };
  }, [syncNow]);

  return (
    <SyncContext.Provider value={{ online, counts, lastSyncedAt, syncing, syncNow, enqueueAction }}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSync(): SyncContextValue {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSync must be used within a SyncProvider');
  return ctx;
}
