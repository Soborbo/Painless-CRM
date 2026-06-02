// Phase 14 — storage performance report: recurring revenue (MRR), movement
// (new vs churned in the period) and churn rate. Pure aggregation; the
// Supabase reads live in lib/queries/storage-rental.ts. Container occupancy
// reuses lib/storage/occupancy.summariseOccupancy.
//
// MRR model: only *active* rentals bill, so they are the live MRR. Pending
// rentals are reserved-but-not-yet-billing — surfaced separately as pipeline.
// Movement is range-bound: a rental is "new" when its start_date falls in the
// window, "churned" when its end_date does.

export interface StorageRentalRow {
  status: string | null;
  monthly_rate_pence: number | null;
  start_date: string | null;
  end_date: string | null;
}

export interface StorageReport {
  /** Live billing rentals. */
  activeRentals: number;
  /** Reserved, not yet billing. */
  pendingRentals: number;
  /** Sum of active monthly rates — current monthly recurring revenue. */
  mrrPence: number;
  /** Sum of pending monthly rates — pipeline once they go active. */
  pendingMrrPence: number;
  /** mrr / active rentals, in pence, or null when none active. */
  avgRatePence: number | null;
  /** Rentals whose start_date falls in the window. */
  newInPeriod: number;
  /** Monthly value added by those new rentals. */
  newMrrPence: number;
  /** Rentals whose end_date (termination) falls in the window. */
  churnedInPeriod: number;
  /** Monthly value lost to those terminations. */
  churnedMrrPence: number;
  /** newMrrPence − churnedMrrPence: net monthly revenue movement. */
  netMrrChangePence: number;
  /**
   * Churned / (active now + churned in period), 0–100, or null when there is
   * nothing to churn. An approximation: the denominator is the live base plus
   * what left during the window, standing in for the period's opening base.
   */
  churnRatePct: number | null;
}

function inWindow(date: string | null, startMs: number, endMs: number): boolean {
  if (!date) return false;
  const t = new Date(date).getTime();
  return t >= startMs && t < endMs;
}

export function buildStorageReport(
  rows: readonly StorageRentalRow[],
  range: { startIso: string; endIso: string },
): StorageReport {
  const startMs = new Date(range.startIso).getTime();
  const endMs = new Date(range.endIso).getTime();

  let activeRentals = 0;
  let pendingRentals = 0;
  let mrrPence = 0;
  let pendingMrrPence = 0;
  let newInPeriod = 0;
  let newMrrPence = 0;
  let churnedInPeriod = 0;
  let churnedMrrPence = 0;

  for (const r of rows) {
    const rate = r.monthly_rate_pence ?? 0;
    if (r.status === 'active') {
      activeRentals += 1;
      mrrPence += rate;
    } else if (r.status === 'pending') {
      pendingRentals += 1;
      pendingMrrPence += rate;
    }
    if (inWindow(r.start_date, startMs, endMs)) {
      newInPeriod += 1;
      newMrrPence += rate;
    }
    if (r.status === 'terminated' && inWindow(r.end_date, startMs, endMs)) {
      churnedInPeriod += 1;
      churnedMrrPence += rate;
    }
  }

  const churnBase = activeRentals + churnedInPeriod;
  return {
    activeRentals,
    pendingRentals,
    mrrPence,
    pendingMrrPence,
    avgRatePence: activeRentals > 0 ? Math.round(mrrPence / activeRentals) : null,
    newInPeriod,
    newMrrPence,
    churnedInPeriod,
    churnedMrrPence,
    netMrrChangePence: newMrrPence - churnedMrrPence,
    churnRatePct: churnBase > 0 ? (churnedInPeriod / churnBase) * 100 : null,
  };
}
