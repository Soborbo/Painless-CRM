import { type StorageRentalRow, buildStorageReport } from '@/lib/reports/storage';
import { describe, expect, it } from 'vitest';

function row(o: Partial<StorageRentalRow>): StorageRentalRow {
  return {
    status: 'active',
    monthly_rate_pence: 0,
    start_date: '2026-01-01',
    end_date: null,
    ...o,
  };
}

// June 2026 window (resolveRange-shaped).
const RANGE = { startIso: '2026-06-01T00:00:00Z', endIso: '2026-07-01T00:00:00Z' };

describe('buildStorageReport', () => {
  it('counts active/pending and sums MRR from active rentals only', () => {
    const r = buildStorageReport(
      [
        row({ status: 'active', monthly_rate_pence: 100_00 }),
        row({ status: 'active', monthly_rate_pence: 200_00 }),
        row({ status: 'pending', monthly_rate_pence: 50_00 }),
        row({ status: 'terminated', monthly_rate_pence: 999_00, end_date: '2025-01-01' }),
      ],
      RANGE,
    );
    expect(r.activeRentals).toBe(2);
    expect(r.pendingRentals).toBe(1);
    expect(r.mrrPence).toBe(300_00);
    expect(r.pendingMrrPence).toBe(50_00);
    expect(r.avgRatePence).toBe(150_00);
  });

  it('counts new rentals by start_date falling in the window', () => {
    const r = buildStorageReport(
      [
        row({ start_date: '2026-06-15', monthly_rate_pence: 100_00 }),
        row({ start_date: '2026-05-31', monthly_rate_pence: 999_00 }), // before window
      ],
      RANGE,
    );
    expect(r.newInPeriod).toBe(1);
    expect(r.newMrrPence).toBe(100_00);
  });

  it('counts churn by termination end_date in the window and nets MRR movement', () => {
    const r = buildStorageReport(
      [
        // active all period
        row({ status: 'active', monthly_rate_pence: 300_00, start_date: '2025-01-01' }),
        // new this period
        row({ status: 'active', monthly_rate_pence: 100_00, start_date: '2026-06-10' }),
        // churned this period
        row({
          status: 'terminated',
          monthly_rate_pence: 80_00,
          start_date: '2024-01-01',
          end_date: '2026-06-20',
        }),
      ],
      RANGE,
    );
    expect(r.churnedInPeriod).toBe(1);
    expect(r.churnedMrrPence).toBe(80_00);
    expect(r.netMrrChangePence).toBe(100_00 - 80_00);
    // churn rate = 1 / (2 active + 1 churned) = 33.3%
    expect(Math.round(r.churnRatePct ?? 0)).toBe(33);
  });

  it('ignores a termination dated outside the window', () => {
    const r = buildStorageReport(
      [row({ status: 'terminated', monthly_rate_pence: 80_00, end_date: '2026-05-01' })],
      RANGE,
    );
    expect(r.churnedInPeriod).toBe(0);
    expect(r.churnRatePct).toBeNull();
  });

  it('returns null averages/rates when there is nothing active', () => {
    const r = buildStorageReport([], RANGE);
    expect(r.avgRatePence).toBeNull();
    expect(r.churnRatePct).toBeNull();
    expect(r.mrrPence).toBe(0);
  });
});
