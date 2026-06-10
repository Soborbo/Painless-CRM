import { type StatementInvoice, buildStatement } from '@/lib/statements/statement';
import { serializeStatementToCsv } from '@/lib/statements/statement-csv';
import { describe, expect, it } from 'vitest';

function inv(over: Partial<StatementInvoice>): StatementInvoice {
  return {
    invoice_number: 'PR-1',
    type: 'final',
    status: 'sent',
    total_pence: 10000,
    amount_paid_pence: 0,
    amount_outstanding_pence: 10000,
    issued_at: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

describe('buildStatement', () => {
  it('orders oldest-first and runs a balance', () => {
    const s = buildStatement([
      inv({
        invoice_number: 'PR-2',
        issued_at: '2026-03-01T00:00:00.000Z',
        amount_outstanding_pence: 5000,
      }),
      inv({
        invoice_number: 'PR-1',
        issued_at: '2026-01-01T00:00:00.000Z',
        amount_outstanding_pence: 10000,
      }),
    ]);
    expect(s.lines.map((l) => l.invoice_number)).toEqual(['PR-1', 'PR-2']);
    expect(s.lines.map((l) => l.running_outstanding_pence)).toEqual([10000, 15000]);
  });

  it('totals invoiced/paid/outstanding', () => {
    const s = buildStatement([
      inv({ total_pence: 10000, amount_paid_pence: 10000, amount_outstanding_pence: 0 }),
      inv({
        invoice_number: 'PR-2',
        total_pence: 4000,
        amount_paid_pence: 1000,
        amount_outstanding_pence: 3000,
      }),
    ]);
    expect(s.totalInvoicedPence).toBe(14000);
    expect(s.totalPaidPence).toBe(11000);
    expect(s.totalOutstandingPence).toBe(3000);
  });

  it('is empty for no invoices', () => {
    expect(buildStatement([])).toEqual({
      lines: [],
      totalInvoicedPence: 0,
      totalPaidPence: 0,
      totalOutstandingPence: 0,
    });
  });
});

describe('serializeStatementToCsv', () => {
  it('emits a header and one row per line', () => {
    const csv = serializeStatementToCsv(buildStatement([inv({})]));
    const lines = csv.trimEnd().split('\r\n');
    expect(lines[0]).toContain('invoice_number');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('PR-1');
  });
  it('header-only when empty', () => {
    expect(serializeStatementToCsv(buildStatement([])).trimEnd().split('\r\n')).toHaveLength(1);
  });
});
