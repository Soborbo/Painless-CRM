import { deriveSyncState, unsyncedCount } from '@/lib/worker/sync-status';
import { describe, expect, it } from 'vitest';

describe('deriveSyncState', () => {
  it('is offline whenever there is no connection, regardless of counts', () => {
    expect(deriveSyncState({ online: false, pendingCount: 0, failedCount: 0 })).toBe('offline');
    expect(deriveSyncState({ online: false, pendingCount: 3, failedCount: 1 })).toBe('offline');
  });
  it('prioritises failed over pending when online', () => {
    expect(deriveSyncState({ online: true, pendingCount: 2, failedCount: 1 })).toBe('failed');
  });
  it('is pending when items wait but none have failed', () => {
    expect(deriveSyncState({ online: true, pendingCount: 2, failedCount: 0 })).toBe('pending');
  });
  it('is synced when online and the queue is empty', () => {
    expect(deriveSyncState({ online: true, pendingCount: 0, failedCount: 0 })).toBe('synced');
  });
});

describe('unsyncedCount', () => {
  it('sums pending and failed', () => {
    expect(unsyncedCount({ pendingCount: 2, failedCount: 1 })).toBe(3);
    expect(unsyncedCount({ pendingCount: 0, failedCount: 0 })).toBe(0);
  });
});
