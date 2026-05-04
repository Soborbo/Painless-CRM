import { MAX_ACTIVE_LEADS_PER_REP, type SalesRep, pickNextRep } from '@/lib/jobs/routing';
import { describe, expect, it } from 'vitest';

const reps: SalesRep[] = [
  { id: 'a', full_name: 'Alice', active: true },
  { id: 'b', full_name: 'Bob', active: true },
  { id: 'c', full_name: 'Carol', active: true },
];

describe('pickNextRep', () => {
  it('returns the first rep when no one has been assigned yet', () => {
    expect(pickNextRep(reps, [], null)?.id).toBe('a');
  });

  it('rotates to the next rep after the last assignee', () => {
    expect(pickNextRep(reps, [], 'a')?.id).toBe('b');
    expect(pickNextRep(reps, [], 'b')?.id).toBe('c');
    expect(pickNextRep(reps, [], 'c')?.id).toBe('a');
  });

  it('skips inactive reps', () => {
    const partlyActive = reps.map((r) => (r.id === 'b' ? { ...r, active: false } : r));
    expect(pickNextRep(partlyActive, [], 'a')?.id).toBe('c');
  });

  it('skips reps at the active-lead cap', () => {
    const loads = [{ rep_id: 'b', active_count: MAX_ACTIVE_LEADS_PER_REP }];
    expect(pickNextRep(reps, loads, 'a')?.id).toBe('c');
  });

  it('returns null when no rep is eligible', () => {
    const loads = reps.map((r) => ({ rep_id: r.id, active_count: MAX_ACTIVE_LEADS_PER_REP }));
    expect(pickNextRep(reps, loads, null)).toBeNull();
  });

  it('returns null when there are no reps', () => {
    expect(pickNextRep([], [], null)).toBeNull();
  });

  it('handles an unknown lastAssignedRepId gracefully', () => {
    expect(pickNextRep(reps, [], 'zzz')?.id).toBe('a');
  });
});
