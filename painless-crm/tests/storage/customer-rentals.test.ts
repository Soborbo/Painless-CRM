import { type RentalSummaryInput, summarizeCustomerRentals } from '@/lib/storage/customer-rentals';
import { describe, expect, it } from 'vitest';

describe('summarizeCustomerRentals', () => {
  it('counts and totals only current (pending/active) rentals', () => {
    const rentals: RentalSummaryInput[] = [
      { status: 'active', monthly_rate_pence: 5000 },
      { status: 'pending', monthly_rate_pence: 3000 },
      { status: 'terminated', monthly_rate_pence: 9999 },
    ];
    expect(summarizeCustomerRentals(rentals)).toEqual({
      activeCount: 2,
      monthlyTotalPence: 8000,
    });
  });

  it('ignores unknown or null statuses', () => {
    const rentals: RentalSummaryInput[] = [
      { status: null, monthly_rate_pence: 1000 },
      { status: 'bogus', monthly_rate_pence: 2000 },
    ];
    expect(summarizeCustomerRentals(rentals)).toEqual({
      activeCount: 0,
      monthlyTotalPence: 0,
    });
  });

  it('returns zeroes for no rentals', () => {
    expect(summarizeCustomerRentals([])).toEqual({ activeCount: 0, monthlyTotalPence: 0 });
  });
});
