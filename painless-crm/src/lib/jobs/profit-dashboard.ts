// Profit dashboard pure helpers. Phase 06b §2b / ADR-019.
//
// Range maths and roll-up totals live here so the page renders
// deterministically against a fixed `now` and so the aggregation
// stays unit-testable. The Supabase reads themselves are over in
// `src/lib/queries/profit-dashboard.ts`.

import { type ProfitReviewStatus, computeProfit } from '@/lib/jobs/profit';

export interface DateRange {
  startIso: string;
  endIso: string;
}

export function monthRange(now: Date): DateRange {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

export function quarterRange(now: Date): DateRange {
  const month = now.getUTCMonth();
  const quarterStart = Math.floor(month / 3) * 3;
  const start = new Date(Date.UTC(now.getUTCFullYear(), quarterStart, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), quarterStart + 3, 1));
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

export type ProfitRange = 'month' | 'quarter';

export function resolveRange(kind: ProfitRange, now: Date): DateRange {
  return kind === 'quarter' ? quarterRange(now) : monthRange(now);
}

export interface ProfitDashboardJob {
  id: string;
  job_number: string;
  stage: string;
  completed_at: string | null;
  acquisition_source: string | null;
  profit_review_status: ProfitReviewStatus;
  actual_crew_cost_pence: number | null;
  actual_van_cost_pence: number | null;
  passthrough_costs_pence: number | null;
  revenuePence: number;
  customer: {
    customer_type: string;
    first_name: string | null;
    last_name: string | null;
    company_name: string | null;
    primary_email: string | null;
  } | null;
  assigned_to: { id: string; full_name: string } | null;
}

export interface ProfitDashboardTotals {
  revenuePence: number;
  costPence: number;
  profitPence: number;
  marginPct: number | null;
  jobCount: number;
  pendingReviewCount: number;
}

export function aggregateProfit(rows: readonly ProfitDashboardJob[]): ProfitDashboardTotals {
  let revenue = 0;
  let cost = 0;
  let pending = 0;
  for (const row of rows) {
    const r = computeProfit({
      revenuePence: row.revenuePence,
      crewPence: row.actual_crew_cost_pence ?? 0,
      vanPence: row.actual_van_cost_pence ?? 0,
      passthroughPence: row.passthrough_costs_pence ?? 0,
    });
    revenue += row.revenuePence;
    cost += r.totalCostPence;
    if (row.profit_review_status === 'pending') pending += 1;
  }
  const profit = revenue - cost;
  return {
    revenuePence: revenue,
    costPence: cost,
    profitPence: profit,
    marginPct: revenue > 0 ? (profit / revenue) * 100 : null,
    jobCount: rows.length,
    pendingReviewCount: pending,
  };
}
