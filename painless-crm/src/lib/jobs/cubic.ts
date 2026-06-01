// Phase 10 §3 — pure cubic-sheet summary. Rolls itemized inventory into the
// totals the survey + quote care about. Date/IO-free so it's unit tested.

export interface CubicItemLike {
  quantity: number | null;
  cubic_ft_each: number | null;
  cubic_ft_total: number | null;
  fragile: boolean | null;
  dismantle_required: boolean | null;
}

export interface CubicSummary {
  itemCount: number; // distinct line items
  totalUnits: number; // sum of quantities
  totalCubicFt: number;
  fragileCount: number; // line items flagged fragile
  dismantleCount: number; // line items needing dismantling
}

export function summariseCubicSheet(items: CubicItemLike[]): CubicSummary {
  const summary: CubicSummary = {
    itemCount: items.length,
    totalUnits: 0,
    totalCubicFt: 0,
    fragileCount: 0,
    dismantleCount: 0,
  };
  for (const item of items) {
    const qty = item.quantity ?? 0;
    // Prefer the DB-computed total; fall back to qty × each for unsaved rows.
    const total = item.cubic_ft_total ?? qty * (item.cubic_ft_each ?? 0);
    summary.totalUnits += qty;
    summary.totalCubicFt += total;
    if (item.fragile) summary.fragileCount += 1;
    if (item.dismantle_required) summary.dismantleCount += 1;
  }
  // Avoid binary-float drift on the cubic total.
  summary.totalCubicFt = Math.round(summary.totalCubicFt * 100) / 100;
  return summary;
}
