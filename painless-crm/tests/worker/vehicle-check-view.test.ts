import {
  LOW_FUEL_THRESHOLD,
  countNeedingAttention,
  vehicleCheckFlags,
} from '@/lib/worker/vehicle-check-view';
import { describe, expect, it } from 'vitest';

describe('vehicleCheckFlags', () => {
  it('flags nothing for a clean, full check', () => {
    const f = vehicleCheckFlags({ walk_around_clear: true, defects_noted: null, fuel_level: 80 });
    expect(f).toEqual({
      hasDefects: false,
      failedWalkAround: false,
      lowFuel: false,
      needsAttention: false,
    });
  });

  it('flags defects when notes are present', () => {
    const f = vehicleCheckFlags({
      walk_around_clear: true,
      defects_noted: 'cracked wing mirror',
      fuel_level: 90,
    });
    expect(f.hasDefects).toBe(true);
    expect(f.needsAttention).toBe(true);
  });

  it('treats whitespace-only defect notes as no defects', () => {
    const f = vehicleCheckFlags({ walk_around_clear: true, defects_noted: '   ', fuel_level: 90 });
    expect(f.hasDefects).toBe(false);
    expect(f.needsAttention).toBe(false);
  });

  it('flags an explicit failed walk-around but not a null one', () => {
    expect(vehicleCheckFlags({ walk_around_clear: false, defects_noted: null, fuel_level: 90 }).failedWalkAround).toBe(true);
    expect(vehicleCheckFlags({ walk_around_clear: null, defects_noted: null, fuel_level: 90 }).failedWalkAround).toBe(false);
  });

  it('flags low fuel strictly below the threshold', () => {
    expect(vehicleCheckFlags({ walk_around_clear: true, defects_noted: null, fuel_level: LOW_FUEL_THRESHOLD - 1 }).lowFuel).toBe(true);
    expect(vehicleCheckFlags({ walk_around_clear: true, defects_noted: null, fuel_level: LOW_FUEL_THRESHOLD }).lowFuel).toBe(false);
    expect(vehicleCheckFlags({ walk_around_clear: true, defects_noted: null, fuel_level: null }).lowFuel).toBe(false);
  });
});

describe('countNeedingAttention', () => {
  it('counts only the rows needing attention', () => {
    const checks = [
      { walk_around_clear: true, defects_noted: null, fuel_level: 80 },
      { walk_around_clear: false, defects_noted: null, fuel_level: 80 },
      { walk_around_clear: true, defects_noted: 'dent', fuel_level: 80 },
      { walk_around_clear: true, defects_noted: null, fuel_level: 10 },
    ];
    expect(countNeedingAttention(checks)).toBe(3);
  });

  it('returns 0 for an empty batch', () => {
    expect(countNeedingAttention([])).toBe(0);
  });
});
