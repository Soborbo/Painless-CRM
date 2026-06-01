// Phase 12 §2/§3 — pure rules for auto-created invoices. The deposit on quote
// acceptance and the final on job completion both derive their amounts here, so
// the policy is testable and lives in one place.

// Deposit policy: individuals get a deposit invoice; business (b2b) customers
// are billed on terms, so skip. Also skip below a configurable floor.
export function shouldCreateDeposit(
  customerType: string | null,
  quoteTotalPence: number,
  minThresholdPence: number,
): boolean {
  if (customerType === 'business') return false;
  return quoteTotalPence >= Math.max(minThresholdPence, 1);
}

export function depositAmountPence(quoteTotalPence: number, depositPercent: number): number {
  const pct = Number.isFinite(depositPercent) ? depositPercent : 0;
  return Math.round((quoteTotalPence * pct) / 100);
}

// Final invoice clears whatever the quote total hasn't been invoiced yet
// (deposits/custom already raised). Never negative.
export function finalBalancePence(quoteTotalPence: number, alreadyInvoicedPence: number): number {
  return Math.max(0, quoteTotalPence - alreadyInvoicedPence);
}
