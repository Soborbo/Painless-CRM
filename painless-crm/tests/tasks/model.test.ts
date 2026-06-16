import {
  completeness,
  dueBucket,
  isOverdue,
  nextSortOrder,
  priorityRank,
  sortQueue,
} from '@/lib/tasks/model';
import { describe, expect, it } from 'vitest';

// Fixed reference point so the day-boundary maths is deterministic.
const NOW = new Date('2026-06-16T12:00:00.000Z');

describe('dueBucket', () => {
  it('returns none when there is no due date', () => {
    expect(dueBucket({ due_at: null, status: 'open' }, NOW)).toBe('none');
  });

  it('never reads completed/cancelled tasks as overdue', () => {
    const past = { due_at: '2026-06-01T00:00:00.000Z', status: 'done' as const };
    expect(dueBucket(past, NOW)).toBe('none');
    expect(dueBucket({ ...past, status: 'cancelled' }, NOW)).toBe('none');
  });

  it('classifies overdue, today, upcoming and later', () => {
    expect(dueBucket({ due_at: '2026-06-15T23:00:00.000Z', status: 'open' }, NOW)).toBe('overdue');
    expect(dueBucket({ due_at: '2026-06-16T18:00:00.000Z', status: 'open' }, NOW)).toBe('today');
    expect(dueBucket({ due_at: '2026-06-19T00:00:00.000Z', status: 'open' }, NOW)).toBe('upcoming');
    expect(dueBucket({ due_at: '2026-07-01T00:00:00.000Z', status: 'open' }, NOW)).toBe('later');
  });

  it('isOverdue is true only for the overdue bucket', () => {
    expect(isOverdue({ due_at: '2026-06-10T00:00:00.000Z', status: 'open' }, NOW)).toBe(true);
    expect(isOverdue({ due_at: '2026-06-16T18:00:00.000Z', status: 'open' }, NOW)).toBe(false);
  });
});

describe('priorityRank', () => {
  it('orders high > medium > low', () => {
    expect(priorityRank('high')).toBeGreaterThan(priorityRank('medium'));
    expect(priorityRank('medium')).toBeGreaterThan(priorityRank('low'));
  });
});

describe('sortQueue', () => {
  it('puts overdue first, then by priority, then by soonest due, without mutating input', () => {
    const input = [
      { due_at: '2026-07-01T00:00:00.000Z', status: 'open' as const, priority: 'high' as const },
      { due_at: '2026-06-10T00:00:00.000Z', status: 'open' as const, priority: 'low' as const },
      { due_at: '2026-06-16T09:00:00.000Z', status: 'open' as const, priority: 'low' as const },
      { due_at: '2026-06-16T08:00:00.000Z', status: 'open' as const, priority: 'high' as const },
    ];
    const out = sortQueue(input, NOW);
    expect(out.map((o) => o.due_at)).toEqual([
      '2026-06-10T00:00:00.000Z', // overdue wins
      '2026-06-16T08:00:00.000Z', // today: high before low
      '2026-06-16T09:00:00.000Z',
      '2026-07-01T00:00:00.000Z', // later last
    ]);
    expect(out[1]?.priority).toBe('high');
    expect(input[0]?.due_at).toBe('2026-07-01T00:00:00.000Z'); // input untouched
  });
});

describe('completeness', () => {
  it('reports 0% for an empty list', () => {
    expect(completeness([])).toEqual({ total: 0, done: 0, percent: 0 });
  });

  it('counts done status against total and rounds', () => {
    expect(
      completeness([{ status: 'done' }, { status: 'open' }, { status: 'done' }]),
    ).toEqual({ total: 3, done: 2, percent: 67 });
  });
});

describe('nextSortOrder', () => {
  it('is 0 for an empty list and one past the max otherwise', () => {
    expect(nextSortOrder([])).toBe(0);
    expect(nextSortOrder([{ sort_order: 0 }, { sort_order: 5 }, { sort_order: 2 }])).toBe(6);
  });
});
