import { type Statement, type StatementInvoice, buildStatement } from '@/lib/statements/statement';
import { createClient } from '@/lib/supabase/server';

// Phase 26 — per-customer account statement read. RLS scopes to the company.

const COLUMNS =
  'invoice_number, type, status, total_pence, amount_paid_pence, amount_outstanding_pence, issued_at';

export async function getCustomerStatement(customerId: string): Promise<Statement> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('invoices')
    .select(COLUMNS)
    .eq('customer_id', customerId)
    .is('deleted_at', null)
    .neq('status', 'draft')
    .limit(1000);
  return buildStatement(
    ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
      invoice_number: r.invoice_number as string,
      type: (r.type as string | null) ?? null,
      status: (r.status as string | null) ?? null,
      total_pence: (r.total_pence as number | null) ?? 0,
      amount_paid_pence: (r.amount_paid_pence as number | null) ?? 0,
      amount_outstanding_pence: (r.amount_outstanding_pence as number | null) ?? 0,
      issued_at: (r.issued_at as string | null) ?? null,
    })) satisfies StatementInvoice[],
  );
}
