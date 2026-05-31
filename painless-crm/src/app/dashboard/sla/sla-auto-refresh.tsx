'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// Pulls fresh SLA queue data on an interval so new leads appear and responded
// ones drop off without a manual reload (Phase 06b §1, acceptance #3). This is
// the v0.1 stand-in for the Supabase Realtime subscription noted in
// lib/queries/sla-queue.ts — a plain router.refresh() re-runs the server
// component and reconciles the DOM. Paused while the tab is hidden so an idle
// board doesn't poll the database all night.

const REFRESH_MS = 60_000;

export function SlaAutoRefresh() {
  const router = useRouter();

  useEffect(() => {
    let id: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (id === null) id = setInterval(() => router.refresh(), REFRESH_MS);
    };
    const stop = () => {
      if (id !== null) {
        clearInterval(id);
        id = null;
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        router.refresh();
        start();
      } else {
        stop();
      }
    };

    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [router]);

  return null;
}
