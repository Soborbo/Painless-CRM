import { isCurrentRental, isRentalStatus } from '@/lib/storage/rental-lifecycle';

// Customer 360 §Storage — pure summary of a customer's rentals for the header
// stats. "Current" (pending or active, per the lifecycle rules) rentals are the
// ones a customer is still on the hook for, so they drive the active count and
// the recurring monthly total; terminated rentals are history.

export interface RentalSummaryInput {
  status: string | null;
  monthly_rate_pence: number;
}

export interface RentalSummary {
  activeCount: number;
  monthlyTotalPence: number;
}

export function summarizeCustomerRentals(rentals: readonly RentalSummaryInput[]): RentalSummary {
  let activeCount = 0;
  let monthlyTotalPence = 0;
  for (const r of rentals) {
    if (isRentalStatus(r.status) && isCurrentRental(r.status)) {
      activeCount += 1;
      monthlyTotalPence += r.monthly_rate_pence;
    }
  }
  return { activeCount, monthlyTotalPence };
}
