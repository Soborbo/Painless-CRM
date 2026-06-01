import {
  type CapacityBand,
  DEFAULT_DAILY_CAPACITY_HOURS,
  deriveBand,
  effectiveBand,
  isCapacityBand,
  utilization,
} from '@/lib/capacity/band';
import { capacityWindow, chunkIntoWeeks, dateKey, enumerateDays } from '@/lib/capacity/calendar';
import { describe, expect, it } from 'vitest';

const MAX = DEFAULT_DAILY_CAPACITY_HOURS; // 48

describe('deriveBand', () => {
  it('is green below 60% utilisation', () => {
    expect(deriveBand(0, MAX)).toBe('green');
    expect(deriveBand(MAX * 0.59, MAX)).toBe('green');
  });
  it('is yellow from 60% to under 90%', () => {
    expect(deriveBand(MAX * 0.6, MAX)).toBe('yellow');
    expect(deriveBand(MAX * 0.89, MAX)).toBe('yellow');
  });
  it('is red at 90% and above', () => {
    expect(deriveBand(MAX * 0.9, MAX)).toBe('red');
    expect(deriveBand(MAX * 2, MAX)).toBe('red');
  });
  it('treats a zero/invalid max as fully loaded (red)', () => {
    expect(deriveBand(0, 0)).toBe('red');
  });
});

describe('utilization', () => {
  it('is committed / max, or 1 when max is non-positive', () => {
    expect(utilization(24, 48)).toBe(0.5);
    expect(utilization(5, 0)).toBe(1);
  });
});

describe('effectiveBand', () => {
  it('lets an override win over the derived band', () => {
    expect(effectiveBand('green', 'red')).toBe('red');
    expect(effectiveBand('red', 'closed')).toBe('closed');
  });
  it('keeps the derived band when there is no override', () => {
    expect(effectiveBand('yellow', null)).toBe('yellow');
  });
});

describe('isCapacityBand', () => {
  it('accepts only known bands', () => {
    expect(isCapacityBand('green')).toBe(true);
    expect(isCapacityBand('purple')).toBe(false);
  });
});

describe('capacity calendar helpers', () => {
  it('starts the window on Monday and spans 6 weeks (42 days)', () => {
    // 2026-06-01 is a Monday.
    const w = capacityWindow(new Date('2026-06-03T12:00:00Z'));
    expect(w.startIso.slice(0, 10)).toBe('2026-06-01');
    const days = enumerateDays(w);
    expect(days).toHaveLength(42);
    expect(days[0]).toBe('2026-06-01');
    expect(days[41]).toBe('2026-07-12');
  });

  it('chunks days into weeks of 7', () => {
    const w = capacityWindow(new Date('2026-06-03T12:00:00Z'));
    const weeks = chunkIntoWeeks(enumerateDays(w));
    expect(weeks).toHaveLength(6);
    expect(weeks.every((wk) => wk.length === 7)).toBe(true);
  });

  it('dateKey takes the UTC day portion', () => {
    expect(dateKey('2026-06-15T23:30:00.000Z')).toBe('2026-06-15');
  });

  it('handles a Sunday by snapping back to the prior Monday', () => {
    // 2026-06-07 is a Sunday → week start is 2026-06-01.
    const w = capacityWindow(new Date('2026-06-07T00:00:00Z'));
    expect(w.startIso.slice(0, 10)).toBe('2026-06-01');
  });
});

describe('CapacityBand type guard exhaustiveness', () => {
  it('round-trips every band literal', () => {
    const all: CapacityBand[] = ['green', 'yellow', 'red', 'closed'];
    expect(all.every(isCapacityBand)).toBe(true);
  });
});
