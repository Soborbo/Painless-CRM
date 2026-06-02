import {
  type FinancialInvoiceRow,
  buildArAging,
  buildRevenueSummary,
} from '@/lib/reports/financial';
import { describe, expect, it } from 'vitest';

function row(o: Partial<FinancialInvoiceRow>): FinancialInvoiceRow {
  return {
    status: 'sent',
    total_pence: 0,
    amount_paid_pence: 0,
    amount_outstanding_pence: 0,
    issued_at: '2026-01-01T00:00:00Z',
    due_at: null,
    ...o,
  };
}

const NOW = '2026-06-02T00:00:00Z';

describe('buildRevenueSummary', () => {
  it('sums invoiced, collected and outstanding across the cohort', () => {
    const s = buildRevenueSummary([
      row({ total_pence: 1000_00, amount_paid_pence: 1000_00, amount_outstanding_pence: 0 }),
      row({ total_pence: 500_00, amount_paid_pence: 200_00, amount_outstanding_pence: 300_00 }),
    ]);
    expect(s).toMatchObject({
      invoiceCount: 2,
      invoicedPence: 1500_00,
      collectedPence: 1200_00,
      outstandingPence: 300_00,
    });
    expect(s.collectionRatePct).toBe(80);
  });

  it('excludes drafts and voids from the cohort', () => {
    const s = buildRevenueSummary([
      row({ status: 'draft', total_pence: 999_00 }),
      row({ status: 'void', total_pence: 999_00 }),
      row({ status: 'paid', total_pence: 100_00, amount_paid_pence: 100_00 }),
    ]);
    expect(s.invoiceCount).toBe(1);
    expect(s.invoicedPence).toBe(100_00);
  });

  it('returns a null collection rate when nothing was invoiced', () => {
    expect(buildRevenueSummary([]).collectionRatePct).toBeNull();
  });
});

describe('buildArAging', () => {
  it('buckets outstanding invoices by days past due', () => {
    const aging = buildArAging(
      [
        // due in the future → current
        row({ due_at: '2026-07-01T00:00:00Z', amount_outstanding_pence: 100_00 }),
        // 15 days overdue → 1–30
        row({ due_at: '2026-05-18T00:00:00Z', amount_outstanding_pence: 200_00 }),
        // 45 days overdue → 31–60
        row({ due_at: '2026-04-18T00:00:00Z', amount_outstanding_pence: 300_00 }),
        // 120 days overdue → 90+
        row({ due_at: '2026-02-02T00:00:00Z', amount_outstanding_pence: 400_00 }),
      ],
      NOW,
    );
    const byKey = Object.fromEntries(aging.buckets.map((b) => [b.key, b]));
    expect(byKey.current?.outstandingPence).toBe(100_00);
    expect(byKey.d1_30?.outstandingPence).toBe(200_00);
    expect(byKey.d31_60?.outstandingPence).toBe(300_00);
    expect(byKey.d90_plus?.outstandingPence).toBe(400_00);
    expect(aging.totalCount).toBe(4);
    expect(aging.totalOutstandingPence).toBe(1000_00);
  });

  it('treats a null due date as current', () => {
    const aging = buildArAging([row({ due_at: null, amount_outstanding_pence: 50_00 })], NOW);
    expect(aging.buckets.find((b) => b.key === 'current')?.outstandingPence).toBe(50_00);
  });

  it('ignores invoices with no outstanding balance and non-receivable statuses', () => {
    const aging = buildArAging(
      [
        row({ amount_outstanding_pence: 0, due_at: '2026-01-01T00:00:00Z' }),
        row({ status: 'void', amount_outstanding_pence: 999_00, due_at: '2026-01-01T00:00:00Z' }),
        row({ status: 'draft', amount_outstanding_pence: 999_00, due_at: '2026-01-01T00:00:00Z' }),
      ],
      NOW,
    );
    expect(aging.totalCount).toBe(0);
    expect(aging.totalOutstandingPence).toBe(0);
  });

  it('always returns all five buckets in order, even when empty', () => {
    const aging = buildArAging([], NOW);
    expect(aging.buckets.map((b) => b.key)).toEqual([
      'current',
      'd1_30',
      'd31_60',
      'd61_90',
      'd90_plus',
    ]);
  });
});
