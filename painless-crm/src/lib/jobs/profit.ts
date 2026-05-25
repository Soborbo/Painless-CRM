// Profit-by-job pure math. Phase 06b §2 / ADR-019.
//
// Inputs are all in pence (the schema's canonical money unit) so the
// arithmetic is exact and roundtrips cleanly to the DB. We avoid
// floating-point cost figures entirely: only the margin percentage —
// derived, never persisted — is a float.

export interface ProfitInputs {
  revenuePence: number;
  crewPence: number;
  vanPence: number;
  passthroughPence: number;
}

export interface ProfitResult {
  totalCostPence: number;
  profitPence: number;
  marginPct: number | null;
}

export const PROFIT_REVIEW_STAGES = ['completed', 'invoiced', 'paid'] as const;
export type ProfitReviewStage = (typeof PROFIT_REVIEW_STAGES)[number];

export function isProfitReviewStage(stage: string): stage is ProfitReviewStage {
  return (PROFIT_REVIEW_STAGES as readonly string[]).includes(stage);
}

export const PROFIT_REVIEW_STATUSES = ['pending', 'reviewed', 'finalized'] as const;
export type ProfitReviewStatus = (typeof PROFIT_REVIEW_STATUSES)[number];

export function computeProfit(inputs: ProfitInputs): ProfitResult {
  const totalCostPence = inputs.crewPence + inputs.vanPence + inputs.passthroughPence;
  const profitPence = inputs.revenuePence - totalCostPence;
  const marginPct = inputs.revenuePence > 0 ? (profitPence / inputs.revenuePence) * 100 : null;
  return { totalCostPence, profitPence, marginPct };
}

export function canEditProfitReview(status: ProfitReviewStatus): boolean {
  return status !== 'finalized';
}

export function canFinaliseProfitReview(status: ProfitReviewStatus, role: string): boolean {
  if (status !== 'reviewed') return false;
  return role === 'admin' || role === 'super_admin';
}
