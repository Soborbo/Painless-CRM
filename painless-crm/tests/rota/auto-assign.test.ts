import { type WorkerLoad, type WorkerOption, pickNextWorker } from '@/lib/rota/auto-assign';
import { describe, expect, it } from 'vitest';

const workers: WorkerOption[] = [
  { id: 'a', full_name: 'Alice' },
  { id: 'b', full_name: 'Bob' },
  { id: 'c', full_name: 'Carol' },
];

describe('pickNextWorker', () => {
  it('picks the least-busy worker', () => {
    const loads: WorkerLoad[] = [
      { worker_id: 'a', count: 3 },
      { worker_id: 'b', count: 1 },
      { worker_id: 'c', count: 5 },
    ];
    expect(pickNextWorker(workers, loads, new Set())?.id).toBe('b');
  });

  it('treats a missing load as zero', () => {
    const loads: WorkerLoad[] = [{ worker_id: 'a', count: 2 }];
    // Bob and Carol both have an implicit load of 0; Bob wins the name tie-break.
    expect(pickNextWorker(workers, loads, new Set())?.id).toBe('b');
  });

  it('breaks ties alphabetically by name then id', () => {
    expect(pickNextWorker(workers, [], new Set())?.id).toBe('a');
  });

  it('skips unavailable workers', () => {
    const loads: WorkerLoad[] = [
      { worker_id: 'a', count: 0 },
      { worker_id: 'b', count: 0 },
    ];
    expect(pickNextWorker(workers, loads, new Set(['a', 'b']))?.id).toBe('c');
  });

  it('returns null when every worker is unavailable', () => {
    expect(pickNextWorker(workers, [], new Set(['a', 'b', 'c']))).toBeNull();
  });

  it('returns null when there are no workers', () => {
    expect(pickNextWorker([], [], new Set())).toBeNull();
  });

  it('does not mutate the input arrays', () => {
    const loads: WorkerLoad[] = [{ worker_id: 'c', count: 9 }];
    const snapshot = [...workers];
    pickNextWorker(workers, loads, new Set());
    expect(workers).toEqual(snapshot);
  });
});
