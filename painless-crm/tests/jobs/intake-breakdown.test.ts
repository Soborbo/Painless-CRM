import { formatIntakeBreakdown } from '@/lib/jobs/intake-breakdown';
import { describe, expect, it } from 'vitest';

describe('formatIntakeBreakdown', () => {
  it('labels known calculator keys and treats values as pounds (not pence)', () => {
    const rows = formatIntakeBreakdown({ crewCost: 800, vansCost: 300 });
    const crew = rows.find((r) => r.key === 'crewCost');
    const vans = rows.find((r) => r.key === 'vansCost');
    expect(crew).toEqual({
      key: 'crewCost',
      label: 'Crew cost',
      display: '£800',
      emphasis: false,
    });
    expect(vans?.display).toBe('£300');
  });

  it('hides internal aggregates (controllable / multiplier / margined / pass-through / subtotal)', () => {
    const rows = formatIntakeBreakdown({
      crewCost: 800,
      controllableCost: 1100,
      marginMultiplier: 1.45,
      marginedTotal: 1595,
      passThroughCost: 235,
      subtotal: 900,
    });
    expect(rows.map((r) => r.key)).toEqual(['crewCost']);
  });

  it('hides the extra-crew headcount (it is not a cost)', () => {
    const rows = formatIntakeBreakdown({ crewCost: 800, complicationExtraCrew: 2 });
    expect(rows.map((r) => r.key)).toEqual(['crewCost']);
  });

  it('renders margin and a bold, last total', () => {
    const rows = formatIntakeBreakdown({ crewCost: 800, margin: 495, total: 2400 });
    expect(rows.map((r) => r.key)).toEqual(['crewCost', 'margin', 'total']);
    const total = rows.find((r) => r.key === 'total');
    expect(total).toEqual({ key: 'total', label: 'Total', display: '£2,400', emphasis: true });
  });

  it('itemises extras and suppresses the lumped extrasCost when per-extra lines exist', () => {
    const rows = formatIntakeBreakdown({
      crewCost: 800,
      packing: 450,
      storage: 984,
      extrasCost: 1434,
    });
    expect(rows.map((r) => r.key)).toEqual(['crewCost', 'packing', 'storage']);
  });

  it('falls back to the lumped extrasCost when no per-extra line is present', () => {
    const rows = formatIntakeBreakdown({ crewCost: 800, extrasCost: 1434 });
    expect(rows.find((r) => r.key === 'extrasCost')?.label).toBe('Extra services');
  });

  it('renders clearance access difficulty as a percentage', () => {
    const rows = formatIntakeBreakdown({ disposalCost: 300, accessDifficultyPercentage: 0.15 });
    expect(rows.find((r) => r.key === 'accessDifficultyPercentage')?.display).toBe('15%');
  });

  it('drops zero-valued and non-finite steps', () => {
    const rows = formatIntakeBreakdown({
      crewCost: 800,
      surchargeCost: 0,
      mileageCost: Number.NaN,
    });
    expect(rows.map((r) => r.key)).toEqual(['crewCost']);
  });

  it('orders known keys by the declared display order, ignoring source order', () => {
    const rows = formatIntakeBreakdown({ total: 2400, crewCost: 800, mileageCost: 85 });
    expect(rows.map((r) => r.key)).toEqual(['crewCost', 'mileageCost', 'total']);
  });

  it('humanises unmapped numeric keys and appends them after known ones', () => {
    const rows = formatIntakeBreakdown({ crewCost: 800, someNewFee: 40 });
    expect(rows.map((r) => r.key)).toEqual(['crewCost', 'someNewFee']);
    const novel = rows.find((r) => r.key === 'someNewFee');
    expect(novel?.label).toBe('Some new fee');
    expect(novel?.display).toBe('£40');
  });

  it('ignores non-numeric values', () => {
    const rows = formatIntakeBreakdown({ crewCost: 800, note: 'hello' });
    expect(rows.map((r) => r.key)).toEqual(['crewCost']);
  });
});
