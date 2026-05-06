import { summariseInternalCost } from '@/lib/quotes/internal-breakdown';
import { describe, expect, it } from 'vitest';

describe('summariseInternalCost', () => {
  it('returns an empty summary for null input', () => {
    expect(summariseInternalCost(null)).toEqual({
      rows: [],
      margin_pct: null,
      margin_modulated: false,
      capacity_band: null,
    });
  });

  it('returns an empty summary when result is missing', () => {
    expect(summariseInternalCost({})).toEqual({
      rows: [],
      margin_pct: null,
      margin_modulated: false,
      capacity_band: null,
    });
  });

  it('extracts the five engine components in canonical order', () => {
    const out = summariseInternalCost({
      result: {
        components: {
          waste_pence: 1000,
          crew_cost_pence: 30000,
          fuel_pence: 4000,
          van_cost_pence: 12000,
          insurance_pence: 2500,
        },
        margin_pence: 9500,
      },
    });
    expect(out.rows.map((r) => r.key)).toEqual([
      'crew_cost_pence',
      'van_cost_pence',
      'fuel_pence',
      'insurance_pence',
      'waste_pence',
      'margin_pence',
    ]);
    expect(out.rows.find((r) => r.key === 'crew_cost_pence')?.pence).toBe(30000);
    expect(out.rows.find((r) => r.key === 'margin_pence')?.pence).toBe(9500);
  });

  it('skips components that are missing or non-numeric', () => {
    const out = summariseInternalCost({
      result: {
        components: {
          crew_cost_pence: 30000,
          van_cost_pence: null,
          fuel_pence: 'oops',
          insurance_pence: Number.NaN,
          waste_pence: 0,
        },
      },
    });
    expect(out.rows.map((r) => r.key)).toEqual(['crew_cost_pence', 'waste_pence']);
  });

  it('reads margin_pct from the breakdown sub-object', () => {
    const out = summariseInternalCost({
      result: {
        components: {},
        breakdown: { margin_pct: 0.42, margin_modulated: true, capacity_band: 'low' },
      },
    });
    expect(out.margin_pct).toBe(0.42);
    expect(out.margin_modulated).toBe(true);
    expect(out.capacity_band).toBe('low');
  });

  it('treats margin_modulated absent as false', () => {
    const out = summariseInternalCost({
      result: { components: {}, breakdown: { margin_pct: 0.4 } },
    });
    expect(out.margin_modulated).toBe(false);
  });

  it('returns null capacity_band for empty / whitespace strings', () => {
    const out = summariseInternalCost({
      result: { components: {}, breakdown: { capacity_band: '  ' } },
    });
    expect(out.capacity_band).toBeNull();
  });

  it('handles a snapshot with components but no breakdown', () => {
    const out = summariseInternalCost({
      result: { components: { crew_cost_pence: 1000 } },
    });
    expect(out.rows).toHaveLength(1);
    expect(out.margin_pct).toBeNull();
  });
});
