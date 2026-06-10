// Phase 16 §1 — commission calculation. Pure + tested. Given an affiliate's
// commission terms and the contracted job revenue (pence), returns the
// commission owed in integer pence. The DB write + idempotency live in
// lib/affiliates/record.ts; this is just the maths.
//
// Value semantics mirror schemas/affiliate.ts:
//   - percent_revenue → commissionValue is a percent (7.5 ⇒ 7.5% of revenue)
//   - flat_per_job     → commissionValue is integer pence, flat per won job
//   - tiered           → commissionConfig.tiers = [{ min_jobs, percent }],
//                        the highest tier whose min_jobs ≤ wonJobCount applies
//                        (percent of revenue). Falls back to 0 with no match.

import type { CommissionType } from '@/lib/schemas/affiliate';

export interface TieredTier {
  min_jobs: number;
  percent: number;
}

export interface CommissionTerms {
  commissionType: CommissionType | null;
  commissionValue: number | null;
  commissionConfig?: unknown;
}

export interface CommissionContext {
  jobRevenuePence: number;
  /** Count of this affiliate's won jobs (incl. the current one) — for tiers. */
  wonJobCount: number;
}

function parseTiers(config: unknown): TieredTier[] {
  if (!config || typeof config !== 'object') return [];
  const tiers = (config as { tiers?: unknown }).tiers;
  if (!Array.isArray(tiers)) return [];
  return tiers
    .filter(
      (t): t is TieredTier =>
        typeof t === 'object' &&
        t !== null &&
        typeof (t as TieredTier).min_jobs === 'number' &&
        typeof (t as TieredTier).percent === 'number',
    )
    .sort((a, b) => a.min_jobs - b.min_jobs);
}

function tierPercentFor(tiers: TieredTier[], wonJobCount: number): number {
  let applicable = 0;
  for (const t of tiers) {
    if (wonJobCount >= t.min_jobs) applicable = t.percent;
  }
  return applicable;
}

const percentOf = (revenuePence: number, percent: number): number =>
  Math.max(0, Math.round((revenuePence * percent) / 100));

export function computeCommissionPence(terms: CommissionTerms, ctx: CommissionContext): number {
  const revenue = Math.max(0, Math.round(ctx.jobRevenuePence));
  switch (terms.commissionType) {
    case 'percent_revenue':
      return percentOf(revenue, terms.commissionValue ?? 0);
    case 'flat_per_job':
      return Math.max(0, Math.round(terms.commissionValue ?? 0));
    case 'tiered': {
      const percent = tierPercentFor(parseTiers(terms.commissionConfig), ctx.wonJobCount);
      return percentOf(revenue, percent);
    }
    default:
      return 0;
  }
}
