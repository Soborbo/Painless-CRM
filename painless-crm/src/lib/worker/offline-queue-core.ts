// Phase 09 §offline queue. Pure scheduling core for the IndexedDB-backed queue
// (ADR-011). The IndexedDB binding and the sync triggers live in the worker app
// (`(worker)/_lib`), but the retry timing and give-up rules are pure and tested
// here so the queue's behaviour is deterministic.

// Backoff between attempts: 1s, 5s, 30s, 5m, 30m (per the Phase 09 spec).
export const RETRY_DELAYS_MS = [1_000, 5_000, 30_000, 300_000, 1_800_000] as const;
export const MAX_ATTEMPTS = RETRY_DELAYS_MS.length;

// Delay to wait before the next attempt, given how many attempts have already
// been made. Returns null once the item has exhausted its retries.
export function nextRetryDelayMs(attempts: number): number | null {
  if (attempts < 0) return RETRY_DELAYS_MS[0];
  if (attempts >= MAX_ATTEMPTS) return null;
  return RETRY_DELAYS_MS[attempts] ?? null;
}

// After MAX_ATTEMPTS failures the item is surfaced for manual retry.
export function hasFailedPermanently(attempts: number): boolean {
  return attempts >= MAX_ATTEMPTS;
}

export interface QueueTiming {
  attempts: number;
  lastAttemptAt: number | null; // epoch ms; null = never attempted
}

// Is the item due for another automatic attempt at `now`? Never-attempted items
// are always due; exhausted items never are.
export function isDueForRetry(item: QueueTiming, now: number): boolean {
  if (hasFailedPermanently(item.attempts)) return false;
  if (item.lastAttemptAt === null) return true;
  const delay = nextRetryDelayMs(item.attempts);
  if (delay === null) return false;
  return now >= item.lastAttemptAt + delay;
}
