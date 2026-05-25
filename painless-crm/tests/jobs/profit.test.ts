import {
  PROFIT_REVIEW_STAGES,
  canEditProfitReview,
  canFinaliseProfitReview,
  computeProfit,
  isProfitReviewStage,
} from '@/lib/jobs/profit';
import { describe, expect, it } from 'vitest';

describe('computeProfit', () => {
  it('sums costs and subtracts from revenue', () => {
    const result = computeProfit({
      revenuePence: 84_000,
      crewPence: 30_000,
      vanPence: 6_000,
      passthroughPence: 4_000,
    });
    expect(result.totalCostPence).toBe(40_000);
    expect(result.profitPence).toBe(44_000);
    expect(result.marginPct).toBeCloseTo(52.38, 1);
  });

  it('reports negative profit when costs exceed revenue', () => {
    const result = computeProfit({
      revenuePence: 20_000,
      crewPence: 18_000,
      vanPence: 5_000,
      passthroughPence: 1_000,
    });
    expect(result.totalCostPence).toBe(24_000);
    expect(result.profitPence).toBe(-4_000);
    expect(result.marginPct).toBeCloseTo(-20, 5);
  });

  it('returns null margin when revenue is zero (no division by zero)', () => {
    const result = computeProfit({
      revenuePence: 0,
      crewPence: 1_000,
      vanPence: 500,
      passthroughPence: 0,
    });
    expect(result.totalCostPence).toBe(1_500);
    expect(result.profitPence).toBe(-1_500);
    expect(result.marginPct).toBeNull();
  });

  it('handles all-zero inputs cleanly', () => {
    expect(
      computeProfit({ revenuePence: 0, crewPence: 0, vanPence: 0, passthroughPence: 0 }),
    ).toEqual({
      totalCostPence: 0,
      profitPence: 0,
      marginPct: null,
    });
  });
});

describe('isProfitReviewStage', () => {
  it('accepts the three eligible stages', () => {
    for (const stage of PROFIT_REVIEW_STAGES) {
      expect(isProfitReviewStage(stage)).toBe(true);
    }
  });

  it('rejects active-pipeline stages', () => {
    expect(isProfitReviewStage('lead')).toBe(false);
    expect(isProfitReviewStage('confirmed')).toBe(false);
    expect(isProfitReviewStage('in_progress')).toBe(false);
  });
});

describe('canEditProfitReview', () => {
  it('allows edits unless finalised', () => {
    expect(canEditProfitReview('pending')).toBe(true);
    expect(canEditProfitReview('reviewed')).toBe(true);
    expect(canEditProfitReview('finalized')).toBe(false);
  });
});

describe('canFinaliseProfitReview', () => {
  it('only admins/super_admins can finalise — and only from "reviewed"', () => {
    expect(canFinaliseProfitReview('reviewed', 'admin')).toBe(true);
    expect(canFinaliseProfitReview('reviewed', 'super_admin')).toBe(true);
    expect(canFinaliseProfitReview('reviewed', 'manager')).toBe(false);
    expect(canFinaliseProfitReview('reviewed', 'sales')).toBe(false);
    expect(canFinaliseProfitReview('pending', 'admin')).toBe(false);
    expect(canFinaliseProfitReview('finalized', 'admin')).toBe(false);
  });
});
