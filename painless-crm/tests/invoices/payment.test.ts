import { deriveInvoiceStatus, splitPayment } from '@/lib/invoices/payment';
import { describe, expect, it } from 'vitest';

describe('splitPayment', () => {
  it('fills the outstanding balance, holding the rest as overpayment', () => {
    expect(splitPayment(5000, 12000)).toEqual({ applied_pence: 5000, overpayment_pence: 0 });
    expect(splitPayment(12000, 12000)).toEqual({ applied_pence: 12000, overpayment_pence: 0 });
    expect(splitPayment(15000, 12000)).toEqual({ applied_pence: 12000, overpayment_pence: 3000 });
  });

  it('treats a fully-paid invoice as all-overpayment', () => {
    expect(splitPayment(5000, 0)).toEqual({ applied_pence: 0, overpayment_pence: 5000 });
  });
});

describe('deriveInvoiceStatus', () => {
  it('marks paid when fully settled and partial when part-paid', () => {
    expect(deriveInvoiceStatus('sent', 10000, 10000)).toBe('paid');
    expect(deriveInvoiceStatus('sent', 10000, 11000)).toBe('paid');
    expect(deriveInvoiceStatus('sent', 10000, 4000)).toBe('partial');
    expect(deriveInvoiceStatus('overdue', 10000, 4000)).toBe('partial');
  });

  it('keeps overdue when still unpaid, and never resurrects a void invoice', () => {
    expect(deriveInvoiceStatus('overdue', 10000, 0)).toBe('overdue');
    expect(deriveInvoiceStatus('void', 10000, 10000)).toBe('void');
  });
});
