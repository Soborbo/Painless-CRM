// Phase 09 §offline queue (ADR-011) — IndexedDB-backed durable queue. Each
// queued action carries its client_event_id (the server dedup key), the
// endpoint to replay it against, and retry bookkeeping. The retry *timing* and
// give-up rules come from the pure, tested lib/worker/offline-queue-core.

import { hasFailedPermanently } from '@/lib/worker/offline-queue-core';

const DB_NAME = 'painless-worker';
const STORE = 'queue';
const DB_VERSION = 1;

export interface QueuedAction {
  client_event_id: string; // primary key
  type: 'clock_in' | 'time_entry' | 'job_sheet' | 'vehicle_check' | 'signoff';
  endpoint: string;
  payload: Record<string, unknown>;
  description: string; // human-readable, for the queue modal
  attempts: number;
  created_at: number;
  last_attempt_at: number | null;
  last_error?: string;
}

export interface QueueCounts {
  pending: number; // still retrying (or never attempted)
  failed: number; // exhausted retries — needs manual action
}

function hasIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'client_event_id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE, mode);
        const req = run(transaction.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        transaction.oncomplete = () => db.close();
      }),
  );
}

export async function enqueue(action: QueuedAction): Promise<void> {
  if (!hasIndexedDb()) return;
  await tx('readwrite', (store) => store.put(action));
}

export async function allQueued(): Promise<QueuedAction[]> {
  if (!hasIndexedDb()) return [];
  const result = await tx<QueuedAction[]>(
    'readonly',
    (store) => store.getAll() as IDBRequest<QueuedAction[]>,
  );
  return result ?? [];
}

export async function removeQueued(clientEventId: string): Promise<void> {
  if (!hasIndexedDb()) return;
  await tx('readwrite', (store) => store.delete(clientEventId));
}

export async function updateQueued(action: QueuedAction): Promise<void> {
  if (!hasIndexedDb()) return;
  await tx('readwrite', (store) => store.put(action));
}

export async function clearFailed(): Promise<void> {
  const items = await allQueued();
  await Promise.all(
    items
      .filter((i) => hasFailedPermanently(i.attempts))
      .map((i) => removeQueued(i.client_event_id)),
  );
}

export async function getCounts(): Promise<QueueCounts> {
  const items = await allQueued();
  let pending = 0;
  let failed = 0;
  for (const item of items) {
    if (hasFailedPermanently(item.attempts)) failed += 1;
    else pending += 1;
  }
  return { pending, failed };
}
