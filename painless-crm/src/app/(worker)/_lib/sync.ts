// Phase 09 §offline queue — the drain step. Replays every due queued action
// against its endpoint, dropping it on success and recording the failure (with
// backoff via the pure core) otherwise. Server-side dedup (client_event_id)
// makes replay safe, so a 2xx — fresh insert or duplicate — always clears it.

import { isDueForRetry } from '@/lib/worker/offline-queue-core';
import { type QueuedAction, allQueued, removeQueued, updateQueued } from './offline-queue';

export interface DrainResult {
  attempted: number;
  succeeded: number;
  failed: number;
}

async function replay(action: QueuedAction): Promise<boolean> {
  const res = await fetch(action.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(action.payload),
  });
  // 409 = server rejects this action permanently (e.g. not assigned) — treat as
  // "done" so it stops retrying; anything else non-2xx is a transient failure.
  if (res.ok) return true;
  if (res.status === 409) return true;
  return false;
}

export async function drainQueue(now: number): Promise<DrainResult> {
  const items = await allQueued();
  let attempted = 0;
  let succeeded = 0;
  let failed = 0;

  for (const item of items) {
    if (!isDueForRetry({ attempts: item.attempts, lastAttemptAt: item.last_attempt_at }, now)) {
      continue;
    }
    attempted += 1;
    try {
      const ok = await replay(item);
      if (ok) {
        await removeQueued(item.client_event_id);
        succeeded += 1;
      } else {
        await updateQueued({
          ...item,
          attempts: item.attempts + 1,
          last_attempt_at: now,
          last_error: 'server_error',
        });
        failed += 1;
      }
    } catch (err) {
      await updateQueued({
        ...item,
        attempts: item.attempts + 1,
        last_attempt_at: now,
        last_error: err instanceof Error ? err.message.slice(0, 120) : 'network',
      });
      failed += 1;
    }
  }

  return { attempted, succeeded, failed };
}
