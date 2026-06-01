'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

// Always-visible connectivity indicator (ADR-011: the worker must always know
// whether their data can reach the server). The full sync-status bar (queued
// counter + "Sync now") arrives with the IndexedDB queue slice; this is the
// connectivity half, surfaced at all times.
export function ConnectionBar() {
  const t = useTranslations('workerApp');
  // Assume online for first paint (SSR has no navigator); correct on mount.
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  if (online) {
    return (
      <div className="flex items-center justify-center gap-2 bg-[var(--color-success,#16a34a)]/10 px-4 py-1 text-xs text-[var(--color-success,#16a34a)]">
        <span aria-hidden>●</span>
        {t('online')}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-2 bg-[var(--color-danger)]/10 px-4 py-1 text-xs font-medium text-[var(--color-danger)]">
      <span aria-hidden>●</span>
      {t('offline')}
    </div>
  );
}
