import { poundsToPence } from '@/lib/money/pounds';
import { describe, expect, it } from 'vitest';

describe('poundsToPence', () => {
  it('converts whole and decimal pounds with integer arithmetic', () => {
    expect(poundsToPence('95')).toBe(9500);
    expect(poundsToPence('95.50')).toBe(9550);
    expect(poundsToPence('0.99')).toBe(99);
    expect(poundsToPence(' 12.00 ')).toBe(1200);
    expect(poundsToPence('-5')).toBe(-500);
  });

  it('avoids float mis-rounding at the half-penny boundary', () => {
    // Math.round(1.005 * 100) === 100 (float error); strict parse gives 101.
    // (1.005 has 3 fraction digits, so it is rejected outright here.)
    expect(poundsToPence('1.005')).toBeNull();
    expect(poundsToPence('2.675')).toBeNull();
  });

  it('rejects non-money tokens (hex, scientific, garbage)', () => {
    expect(poundsToPence('0x10')).toBeNull();
    expect(poundsToPence('1e2')).toBeNull();
    expect(poundsToPence('abc')).toBeNull();
    expect(poundsToPence('')).toBeNull();
    expect(poundsToPence('12.')).toBeNull();
    expect(poundsToPence('1,000')).toBeNull();
  });
});
