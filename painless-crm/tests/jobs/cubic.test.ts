import { pickCubicEstimate, summariseCubicSheet } from '@/lib/jobs/cubic';
import { describe, expect, it } from 'vitest';

describe('pickCubicEstimate', () => {
  it('returns the first positive finite candidate', () => {
    expect(pickCubicEstimate([null, 0, 42, 99])).toBe(42);
  });

  it('skips zero, negatives, NaN and nullish', () => {
    expect(pickCubicEstimate([null, undefined, 0, -5, Number.NaN, 12])).toBe(12);
  });

  it('returns null when nothing is usable', () => {
    expect(pickCubicEstimate([null, 0, -1])).toBeNull();
    expect(pickCubicEstimate([])).toBeNull();
  });
});

describe('summariseCubicSheet', () => {
  it('sums quantities, cubic ft and flags', () => {
    const s = summariseCubicSheet([
      {
        quantity: 2,
        cubic_ft_each: 10,
        cubic_ft_total: 20,
        fragile: true,
        dismantle_required: false,
      },
      {
        quantity: 1,
        cubic_ft_each: 5.5,
        cubic_ft_total: 5.5,
        fragile: false,
        dismantle_required: true,
      },
      { quantity: 3, cubic_ft_each: 1, cubic_ft_total: 3, fragile: true, dismantle_required: true },
    ]);
    expect(s).toEqual({
      itemCount: 3,
      totalUnits: 6,
      totalCubicFt: 28.5,
      fragileCount: 2,
      dismantleCount: 2,
    });
  });

  it('falls back to qty × each when no stored total', () => {
    const s = summariseCubicSheet([
      {
        quantity: 4,
        cubic_ft_each: 2.5,
        cubic_ft_total: null,
        fragile: null,
        dismantle_required: null,
      },
    ]);
    expect(s.totalCubicFt).toBe(10);
    expect(s.totalUnits).toBe(4);
  });

  it('handles an empty sheet', () => {
    expect(summariseCubicSheet([])).toEqual({
      itemCount: 0,
      totalUnits: 0,
      totalCubicFt: 0,
      fragileCount: 0,
      dismantleCount: 0,
    });
  });

  it('avoids float drift on the cubic total', () => {
    const s = summariseCubicSheet([
      {
        quantity: 1,
        cubic_ft_each: 0.1,
        cubic_ft_total: 0.1,
        fragile: false,
        dismantle_required: false,
      },
      {
        quantity: 1,
        cubic_ft_each: 0.2,
        cubic_ft_total: 0.2,
        fragile: false,
        dismantle_required: false,
      },
    ]);
    expect(s.totalCubicFt).toBe(0.3);
  });
});
