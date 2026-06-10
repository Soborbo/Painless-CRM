import { computeCommissionPence } from '@/lib/affiliates/commission';
import { describe, expect, it } from 'vitest';

describe('computeCommissionPence', () => {
  const ctx = { jobRevenuePence: 100_000, wonJobCount: 1 };

  it('returns 0 when no commission type is set', () => {
    expect(computeCommissionPence({ commissionType: null, commissionValue: 10 }, ctx)).toBe(0);
  });

  it('computes a percent of revenue, rounded to pence', () => {
    expect(
      computeCommissionPence({ commissionType: 'percent_revenue', commissionValue: 7.5 }, ctx),
    ).toBe(7_500);
    // rounds: 33.33% of £123.45 (12345p) = 4114.5 → 4115
    expect(
      computeCommissionPence(
        { commissionType: 'percent_revenue', commissionValue: 33.33 },
        { jobRevenuePence: 12_345, wonJobCount: 1 },
      ),
    ).toBe(4115);
  });

  it('returns a flat pence amount regardless of revenue', () => {
    expect(
      computeCommissionPence({ commissionType: 'flat_per_job', commissionValue: 5_000 }, ctx),
    ).toBe(5_000);
  });

  it('applies the highest matching tier by won-job count', () => {
    const terms = {
      commissionType: 'tiered' as const,
      commissionValue: null,
      commissionConfig: {
        tiers: [
          { min_jobs: 1, percent: 5 },
          { min_jobs: 10, percent: 7.5 },
        ],
      },
    };
    // 3 won jobs → 5% tier
    expect(computeCommissionPence(terms, { jobRevenuePence: 100_000, wonJobCount: 3 })).toBe(5_000);
    // 12 won jobs → 7.5% tier
    expect(computeCommissionPence(terms, { jobRevenuePence: 100_000, wonJobCount: 12 })).toBe(
      7_500,
    );
  });

  it('returns 0 for a tiered config with no matching tier or malformed config', () => {
    const terms = {
      commissionType: 'tiered' as const,
      commissionValue: null,
      commissionConfig: { tiers: [{ min_jobs: 10, percent: 7.5 }] },
    };
    expect(computeCommissionPence(terms, { jobRevenuePence: 100_000, wonJobCount: 2 })).toBe(0);
    expect(
      computeCommissionPence(
        { commissionType: 'tiered', commissionValue: null, commissionConfig: null },
        ctx,
      ),
    ).toBe(0);
  });

  it('never returns a negative amount', () => {
    expect(
      computeCommissionPence(
        { commissionType: 'percent_revenue', commissionValue: 10 },
        { jobRevenuePence: -5000, wonJobCount: 1 },
      ),
    ).toBe(0);
  });
});
