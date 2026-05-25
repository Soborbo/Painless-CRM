import {
  type ProfitDashboardJob,
  aggregateProfit,
  monthRange,
  quarterRange,
  resolveRange,
} from '@/lib/jobs/profit-dashboard';
import { describe, expect, it } from 'vitest';

const JOB = (overrides: Partial<ProfitDashboardJob> = {}): ProfitDashboardJob => ({
  id: 'job-1',
  job_number: 'J2026-00001',
  stage: 'paid',
  completed_at: '2026-05-15T10:00:00Z',
  acquisition_source: 'google_ads',
  profit_review_status: 'reviewed',
  actual_crew_cost_pence: 30_000,
  actual_van_cost_pence: 6_000,
  passthrough_costs_pence: 4_000,
  revenuePence: 84_000,
  customer: null,
  assigned_to: null,
  ...overrides,
});

describe('monthRange', () => {
  it('returns the calendar month containing now (UTC)', () => {
    const r = monthRange(new Date('2026-05-15T10:00:00Z'));
    expect(r.startIso).toBe('2026-05-01T00:00:00.000Z');
    expect(r.endIso).toBe('2026-06-01T00:00:00.000Z');
  });

  it('rolls over to January at year-end', () => {
    const r = monthRange(new Date('2026-12-31T23:00:00Z'));
    expect(r.startIso).toBe('2026-12-01T00:00:00.000Z');
    expect(r.endIso).toBe('2027-01-01T00:00:00.000Z');
  });
});

describe('quarterRange', () => {
  it('snaps to the Q2 boundaries when now is in May', () => {
    const r = quarterRange(new Date('2026-05-15T10:00:00Z'));
    expect(r.startIso).toBe('2026-04-01T00:00:00.000Z');
    expect(r.endIso).toBe('2026-07-01T00:00:00.000Z');
  });

  it('treats January as Q1', () => {
    const r = quarterRange(new Date('2026-01-10T10:00:00Z'));
    expect(r.startIso).toBe('2026-01-01T00:00:00.000Z');
    expect(r.endIso).toBe('2026-04-01T00:00:00.000Z');
  });
});

describe('resolveRange', () => {
  it('dispatches by kind', () => {
    const now = new Date('2026-05-15T10:00:00Z');
    expect(resolveRange('month', now)).toEqual(monthRange(now));
    expect(resolveRange('quarter', now)).toEqual(quarterRange(now));
  });
});

describe('aggregateProfit', () => {
  it('rolls up revenue, cost, profit and margin across jobs', () => {
    const totals = aggregateProfit([
      JOB(),
      JOB({
        id: 'job-2',
        revenuePence: 100_000,
        actual_crew_cost_pence: 50_000,
        actual_van_cost_pence: 10_000,
        passthrough_costs_pence: 0,
      }),
    ]);
    expect(totals.revenuePence).toBe(184_000);
    expect(totals.costPence).toBe(100_000);
    expect(totals.profitPence).toBe(84_000);
    expect(totals.marginPct).toBeCloseTo(45.65, 1);
    expect(totals.jobCount).toBe(2);
  });

  it('counts only pending-review jobs in the pending bucket', () => {
    const totals = aggregateProfit([
      JOB({ profit_review_status: 'pending' }),
      JOB({ id: 'job-2', profit_review_status: 'reviewed' }),
      JOB({ id: 'job-3', profit_review_status: 'pending' }),
      JOB({ id: 'job-4', profit_review_status: 'finalized' }),
    ]);
    expect(totals.pendingReviewCount).toBe(2);
    expect(totals.jobCount).toBe(4);
  });

  it('returns null margin when revenue is zero', () => {
    const totals = aggregateProfit([JOB({ revenuePence: 0, actual_crew_cost_pence: 1_000 })]);
    expect(totals.revenuePence).toBe(0);
    expect(totals.marginPct).toBeNull();
  });

  it('treats null cost columns as zero', () => {
    const totals = aggregateProfit([
      JOB({
        revenuePence: 50_000,
        actual_crew_cost_pence: null,
        actual_van_cost_pence: null,
        passthrough_costs_pence: null,
      }),
    ]);
    expect(totals.costPence).toBe(0);
    expect(totals.profitPence).toBe(50_000);
  });

  it('handles an empty list', () => {
    expect(aggregateProfit([])).toEqual({
      revenuePence: 0,
      costPence: 0,
      profitPence: 0,
      marginPct: null,
      jobCount: 0,
      pendingReviewCount: 0,
    });
  });
});
