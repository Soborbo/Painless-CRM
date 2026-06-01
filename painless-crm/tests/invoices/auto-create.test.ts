import {
  depositAmountPence,
  finalBalancePence,
  shouldCreateDeposit,
} from '@/lib/invoices/auto-create';
import { describe, expect, it } from 'vitest';

describe('shouldCreateDeposit', () => {
  it('creates for individuals at/above the floor, skips business + tiny totals', () => {
    expect(shouldCreateDeposit('individual', 100000, 1)).toBe(true);
    expect(shouldCreateDeposit(null, 100000, 1)).toBe(true);
    expect(shouldCreateDeposit('business', 100000, 1)).toBe(false);
    expect(shouldCreateDeposit('individual', 0, 1)).toBe(false);
    expect(shouldCreateDeposit('individual', 5000, 10000)).toBe(false); // below £100 floor
  });
});

describe('depositAmountPence', () => {
  it('takes the configured percent of the gross total, rounded', () => {
    expect(depositAmountPence(100000, 25)).toBe(25000);
    expect(depositAmountPence(99999, 25)).toBe(25000); // 24999.75 → round
    expect(depositAmountPence(100000, 0)).toBe(0);
  });
});

describe('finalBalancePence', () => {
  it('bills the remainder and never goes negative', () => {
    expect(finalBalancePence(100000, 25000)).toBe(75000);
    expect(finalBalancePence(100000, 100000)).toBe(0);
    expect(finalBalancePence(100000, 120000)).toBe(0);
  });
});
