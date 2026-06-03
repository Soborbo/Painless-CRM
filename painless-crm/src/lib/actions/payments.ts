'use server';

import { requireRole } from '@/lib/auth/require-role';
import { enqueueEventAutomation } from '@/lib/comms/automation-enqueue';
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

  const amountPence = Math.round(parsed.data.amount_pounds * 100);

  // Record + allocate + roll up in ONE locked transaction (audit H1 / ADR-037).
  // The RPC holds SELECT ... FOR UPDATE on the invoice, so concurrent payments
  // serialize and cannot over-allocate; tenant isolation is enforced by the
  // company_id arg (server-derived) inside the SECURITY DEFINER function.
  const supabase = await createClient();
  const { data: rpcData, error } = await supabase.rpc('record_payment', {
    p_company_id: me.company_id,
    p_invoice_id: parsed.data.invoice_id,
    p_amount_pence: amountPence,
    p_method: parsed.data.method,
    p_occurred_at: parsed.data.occurred_at ?? null,
    p_reference: parsed.data.reference ?? null,
    p_created_by_id: me.id,
  });
  if (error) {
    const msg = error.message ?? '';
    if (msg.includes('invoice_not_found')) return { status: 'error', message: 'Invoice not found' };
    if (msg.includes('invoice_void'))
      return { status: 'error', message: 'Cannot pay a void invoice' };
    if (msg.includes('invoice_overpaid'))
      return { status: 'error', message: 'That payment exceeds the invoice balance' };
    return { status: 'error', message: 'Could not record the payment' };
  }
  const result = (rpcData ?? null) as { job_id: string | null; invoice_type: string } | null;

  // Fire payment.recorded automation (Phase 13b / ADR-024). Best-effort. `kind`
  // carries the invoice type so the receipt rules target deposit vs final.
  try {
    await enqueueEventAutomation({
      companyId: me.company_id,
      event: 'payment.recorded',
      jobId: result?.job_id ?? null,
      context: { kind: result?.invoice_type },
    });
  } catch {
    // swallow — automation is never on the critical path
  }

  revalidatePath(`/dashboard/invoices/${parsed.data.invoice_id}`);
  revalidatePath('/dashboard/invoices');
  if (result?.job_id) revalidatePath(`/dashboard/jobs/${result.job_id}/invoices`);
  return { status: 'ok' };
}
