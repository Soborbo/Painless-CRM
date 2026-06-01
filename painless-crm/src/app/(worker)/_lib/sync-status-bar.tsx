'use client';

import { deriveSyncState, unsyncedCount } from '@/lib/worker/sync-status';
import { useTranslations } from 'next-intl';
import { useSync } from './sync-context';

// Always-visible sync status bar (ADR-011): current state + unsynced counter +
// a manual "Sync now" button + last-synced time. State derivation is the pure,
// tested deriveSyncState.
export function SyncStatusBar() {
  const t = useTranslations('workerApp');
  const { online, counts, lastSyncedAt, syncing, syncNow } = useSync();
  const state = deriveSyncState({
    online,
    pendingCount: counts.pending,
    failedCount: counts.failed,
  });
  const waiting = unsyncedCount({ pendingCount: counts.pending, failedCount: counts.failed });

  const tone =
    state === 'synced'
      ? 'bg-[var(--color-success,#16a34a)]/10 text-[var(--color-success,#16a34a)]'
      : state === 'offline'
        ? 'bg-[var(--color-danger)]/10 text-[var(--color-danger)]'
        : 'bg-[var(--color-warning)]/10 text-[var(--color-warning)]';

  let label: string;
  if (state === 'offline') label = t('offline');
  else if (state === 'failed') label = t('syncFailed', { count: counts.failed });
  else if (state === 'pending') label = t('unsynced', { count: waiting });
  else label = lastSyncedAt ? t('syncedAt', { time: formatAgo(lastSyncedAt) }) : t('online');

  return (
    <div className={`flex items-center justify-between gap-2 px-4 py-1 text-xs ${tone}`}>
      <span className="flex items-center gap-2">
        <span aria-hidden>●</span>
        {label}
      </span>
      {waiting > 0 || state === 'offline' ? (
        <button
          type="button"
          onClick={() => void syncNow()}
          disabled={syncing || !online}
          className="rounded border border-current px-2 py-0.5 font-medium disabled:opacity-50"
        >
          {syncing ? t('syncing') : t('syncNow')}
        </button>
      ) : null}
    </div>
  );
}

function formatAgo(ts: number): string {
  const mins = Math.max(0, Math.round((Date.now() - ts) / 60_000));
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  return `${Math.round(mins / 60)}h`;
}
