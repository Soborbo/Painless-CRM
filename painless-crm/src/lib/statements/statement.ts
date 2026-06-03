// Phase 26 — per-customer account statement. Pure: turns a customer's invoices
// into an ordered statement with a running outstanding balance. Payments are
// already reflected in each invoice's amount_paid/outstanding, so the statement
// is derived from invoices alone. See ADR-035.

export interface StatementInvoice {
  invoice_number: string;
  type: string | null;
  status: string | null;
  total_pence: number;
  amount_paid_pence: number;
  amount_outstanding_pence: number;
  issued_at: string | null;
}

export interface StatementLine extends StatementInvoice {
  running_outstanding_pence: number;
}

export interface Statement {
  lines: StatementLine[];
  totalInvoicedPence: number;
  totalPaidPence: number;
  totalOutstandingPence: number;
}

export function buildStatement(invoices: readonly StatementInvoice[]): Statement {
  // Oldest first so the running balance reads top-to-bottom; undated sink last.
  const ordered = [...invoices].sort((a, b) =>
    (a.issued_at ?? '￿').localeCompare(b.issued_at ?? '￿'),
  );

  let running = 0;
  let totalInvoiced = 0;
  let totalPaid = 0;
  const lines: StatementLine[] = ordered.map((inv) => {
    running += inv.amount_outstanding_pence;
    totalInvoiced += inv.total_pence;
    totalPaid += inv.amount_paid_pence;
    return { ...inv, running_outstanding_pence: running };
  });

  return {
    lines,
    totalInvoicedPence: totalInvoiced,
    totalPaidPence: totalPaid,
    totalOutstandingPence: running,
  };
}
