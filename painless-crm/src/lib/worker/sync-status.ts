// Phase 09 §offline queue UI. Pure: derive the sync-status-bar state from the
// queue counts and connectivity (ADR-011 always-visible status bar). Kept pure
// so the bar renders consistently and is testable without the DOM.

export type SyncState = 'synced' | 'pending' | 'failed' | 'offline';

export interface SyncSnapshot {
  online: boolean;
  pendingCount: number; // items still waiting to sync (incl. retrying)
  failedCount: number; // items that exhausted their retries
}

// Priority: offline first (nothing can sync), then permanently-failed items
// (needs the worker's attention), then pending, else fully synced.
export function deriveSyncState({ online, pendingCount, failedCount }: SyncSnapshot): SyncState {
  if (!online) return 'offline';
  if (failedCount > 0) return 'failed';
  if (pendingCount > 0) return 'pending';
  return 'synced';
}

// The count to surface in the status badge ("N waiting"). Failed items still
// count as waiting (they need a manual retry), so both are summed.
export function unsyncedCount(
  snapshot: Pick<SyncSnapshot, 'pendingCount' | 'failedCount'>,
): number {
  return snapshot.pendingCount + snapshot.failedCount;
}
