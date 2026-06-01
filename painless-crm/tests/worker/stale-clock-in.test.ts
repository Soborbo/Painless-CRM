import { type TimeEntryInput, findStaleClockIns } from '@/lib/worker/stale-clock-in';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-06-10T18:00:00.000Z');
// 6h cutoff = 12:00. Clock-ins before noon with no closing entry are stale.

function entry(o: Partial<TimeEntryInput>): TimeEntryInput {
  return {
    worker_id: 'w1',
    job_id: 'j1',
    type: 'clock_in',
    occurred_at: '2026-06-10T08:00:00.000Z',
    ...o,
  };
}

describe('findStaleClockIns', () => {
  it('flags a clock-in older than 6h with no closing entry', () => {
    const stale = findStaleClockIns([entry({})], NOW);
    expect(stale).toHaveLength(1);
    expect(stale[0]).toMatchObject({ worker_id: 'w1', job_id: 'j1' });
  });

  it('ignores a clock-in younger than 6h', () => {
    expect(
      findStaleClockIns([entry({ occurred_at: '2026-06-10T13:00:00.000Z' })], NOW),
    ).toHaveLength(0);
  });

  it('clears once a closing entry follows the clock-in', () => {
    const stale = findStaleClockIns(
      [
        entry({ occurred_at: '2026-06-10T08:00:00.000Z' }),
        entry({ type: 'unload_end', occurred_at: '2026-06-10T11:00:00.000Z' }),
      ],
      NOW,
    );
    expect(stale).toHaveLength(0);
  });

  it('stays stale if the only closing entry predates the clock-in', () => {
    const stale = findStaleClockIns(
      [
        entry({ type: 'clock_out', occurred_at: '2026-06-09T17:00:00.000Z' }), // yesterday
        entry({ occurred_at: '2026-06-10T08:00:00.000Z' }),
      ],
      NOW,
    );
    expect(stale).toHaveLength(1);
  });

  it('treats each worker independently', () => {
    const stale = findStaleClockIns(
      [
        entry({ worker_id: 'w1', occurred_at: '2026-06-10T08:00:00.000Z' }),
        entry({ worker_id: 'w2', occurred_at: '2026-06-10T08:30:00.000Z' }),
        entry({ worker_id: 'w2', type: 'load_end', occurred_at: '2026-06-10T10:00:00.000Z' }),
      ],
      NOW,
    );
    expect(stale.map((s) => s.worker_id)).toEqual(['w1']);
  });
});
