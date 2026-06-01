import { canTransition, isEditable } from '@/lib/invoices/status';
import { computeInvoiceTotals, lineSubtotalPence } from '@/lib/invoices/totals';
import { describe, expect, it } from 'vitest';

describe('invoice totals', () => {
  it('computes per-line subtotal in whole pence', () => {
    expect(lineSubtotalPence(3, 1000)).toBe(3000);
    expect(lineSubtotalPence(2.5, 999)).toBe(2498); // 2497.5 → round
  });

  it('sums subtotal, per-line VAT and total', () => {
    const totals = computeInvoiceTotals([
      { quantity: 2, unit_price_pence: 10000, vat_rate: 20 }, // 20000 + 4000
      { quantity: 1, unit_price_pence: 5000, vat_rate: 0 }, // 5000 + 0
    ]);
    expect(totals).toEqual({ subtotal_pence: 25000, vat_pence: 4000, total_pence: 29000 });
  });

  it('handles an empty invoice', () => {
    expect(computeInvoiceTotals([])).toEqual({
      subtotal_pence: 0,
      vat_pence: 0,
      total_pence: 0,
    });
  });
});

describe('invoice status machine', () => {
  it('permits the manual billing path and blocks invalid jumps', () => {
    expect(canTransition('draft', 'sent')).toBe(true);
    expect(canTransition('sent', 'paid')).toBe(true);
    expect(canTransition('sent', 'partial')).toBe(true);
    expect(canTransition('overdue', 'paid')).toBe(true);
    expect(canTransition('draft', 'paid')).toBe(false);
    expect(canTransition('void', 'sent')).toBe(false);
  });

  it('only allows editing lines on a draft', () => {
    expect(isEditable('draft')).toBe(true);
    expect(isEditable('sent')).toBe(false);
    expect(isEditable('paid')).toBe(false);
  });
});
