'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// Keeps the (force-dynamic) Calls inbox live without a manual reload: re-fetches
// the server component on an interval, so a newly-ingested inbound call surfaces
// on its own. Pairs with the ~2-min Tamar poll (ADR-041). Skips the refresh
// while the tab is hidden to avoid pointless background work.
const INTERVAL_MS = 15_000;

export function CallsAutoRefresh() {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (!document.hidden) router.refresh();
    }, INTERVAL_MS);
    return () => clearInterval(id);
  }, [router]);
  return null;
}
