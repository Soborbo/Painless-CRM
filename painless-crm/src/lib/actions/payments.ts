'use server';

import { requireRole } from '@/lib/auth/require-role';
import { deriveInvoiceStatus, splitPayment } from '@/lib/invoices/payment';
import type { InvoiceStatus } from '@/lib/invoices/status';
import { RecordPaymentSchema } from '@/lib/schemas/payment';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

const BILLING_ROLES = ['accounts', 'manager', 'admin', 'super_admin'] as const;

export type PaymentActionState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'ok' };

export const INITIAL_PAYMENT_STATE: PaymentActionState = { status: 'idle' };

// Records a manual payment and allocates it to one invoice. Excess is held as
// customer credit (overpayment_held). The invoice's amount_paid is then
// re-summed from its allocations and its status re-derived (partial/paid).
export async function recordPayment(
  _prev: PaymentActionState,
  form: FormData,
): Promise<PaymentActionState> {
  const me = await requireRole(BILLING_ROLES);

  const parsed = RecordPaymentSchema.safeParse({
    invoice_id: form.get('invoice_id'),
    amount_pounds: form.get('amount_pounds'),
    method: form.get('method'),
    occurred_at: form.get('occurred_at') || undefined,
    reference: form.get('reference') || undefined,
  });
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const supabase = await createClient();
  const { data: invoice } = await supabase
    .from('invoices')
    .select('id, customer_id, total_pence, amount_outstanding_pence, status, version, job_id')
    .eq('id', parsed.data.invoice_id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!invoice) return { status: 'error', message: 'Invoice not found' };

  const inv = invoice as {
    id: string;
    customer_id: string;
    total_pence: number;
    amount_outstanding_pence: number | null;
    status: InvoiceStatus;
    version: number;
    job_id: string | null;
  };
  if (inv.status === 'void') return { status: 'error', message: 'Cannot pay a void invoice' };

  const amountPence = Math.round(parsed.data.amount_pounds * 100);
  const split = splitPayment(amountPence, inv.amount_outstanding_pence ?? 0);

  const { data: payment, error: payErr } = await supabase
    .from('payments')
    .insert({
      company_id: me.company_id,
      customer_id: inv.customer_id,
      amount_pence: amountPence,
      method: parsed.data.method,
      occurred_at: parsed.data.occurred_at ?? new Date().toISOString(),
      reference: parsed.data.reference ?? null,
      source: 'manual',
      created_by_id: me.id,
    })
    .select('id')
    .single();
  if (payErr || !payment) return { status: 'error', message: 'Could not record the payment' };
  const paymentId = (payment as { id: string }).id;

  const allocations: Array<Record<string, unknown>> = [
    {
      company_id: me.company_id,
      payment_id: paymentId,
      invoice_id: inv.id,
      allocation_type: 'payment_to_invoice',
      amount_pence: split.applied_pence,
      allocated_by_id: me.id,
    },
  ];
  if (split.overpayment_pence > 0) {
    allocations.push({
      company_id: me.company_id,
      payment_id: paymentId,
      invoice_id: null,
      allocation_type: 'overpayment_held',
      amount_pence: split.overpayment_pence,
      allocated_by_id: me.id,
    });
  }
  const { error: allocErr } = await supabase.from('payment_allocations').insert(allocations);
  if (allocErr) return { status: 'error', message: 'Could not allocate the payment' };

  // Re-sum what this invoice has actually been allocated, then re-derive status.
  const { data: allocRows } = await supabase
    .from('payment_allocations')
    .select('amount_pence')
    .eq('invoice_id', inv.id)
    .eq('allocation_type', 'payment_to_invoice');
  const paid = ((allocRows ?? []) as Array<{ amount_pence: number }>).reduce(
    (sum, r) => sum + (r.amount_pence ?? 0),
    0,
  );

  await supabase
    .from('invoices')
    .update({
      amount_paid_pence: paid,
      status: deriveInvoiceStatus(inv.status, inv.total_pence, paid),
      version: inv.version + 1,
    })
    .eq('id', inv.id)
    .eq('version', inv.version);

  revalidatePath(`/dashboard/invoices/${inv.id}`);
  revalidatePath('/dashboard/invoices');
  if (inv.job_id) revalidatePath(`/dashboard/jobs/${inv.job_id}/invoices`);
  return { status: 'ok' };
}
