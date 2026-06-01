'use server';

import { requireRole } from '@/lib/auth/require-role';
import { nextInvoiceNumber } from '@/lib/invoices/create';
import { type InvoiceStatus, canTransition } from '@/lib/invoices/status';
import { InvoiceCreateSchema, InvoiceStatusSchema } from '@/lib/schemas/invoice';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

const BILLING_ROLES = ['accounts', 'manager', 'admin', 'super_admin'] as const;

export type InvoiceActionState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'ok' };

export const INITIAL_INVOICE_STATE: InvoiceActionState = { status: 'idle' };

export async function createInvoice(
  _prev: InvoiceActionState,
  form: FormData,
): Promise<InvoiceActionState> {
  const me = await requireRole(BILLING_ROLES);

  const parsed = InvoiceCreateSchema.safeParse({
    customer_id: form.get('customer_id'),
    job_id: form.get('job_id') || undefined,
    type: form.get('type'),
    due_at: form.get('due_at') || undefined,
  });
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const supabase = await createClient();
  // Two attempts: the (company_id, invoice_number) unique index is the race guard.
  let createdId: string | null = null;
  for (let attempt = 0; attempt < 2 && !createdId; attempt++) {
    const invoiceNumber = await nextInvoiceNumber(supabase, me.company_id);
    const { data, error } = await supabase
      .from('invoices')
      .insert({
        company_id: me.company_id,
        customer_id: parsed.data.customer_id,
        job_id: parsed.data.job_id ?? null,
        invoice_number: invoiceNumber,
        type: parsed.data.type,
        status: 'draft',
        subtotal_pence: 0,
        vat_pence: 0,
        total_pence: 0,
        due_at: parsed.data.due_at ?? null,
        created_by_id: me.id,
      })
      .select('id')
      .single();
    if (!error && data) {
      createdId = (data as { id: string }).id;
      break;
    }
    if (error && error.code !== '23505') {
      return { status: 'error', message: 'Could not create the invoice' };
    }
  }
  if (!createdId) return { status: 'error', message: 'Could not allocate an invoice number' };

  revalidatePath('/dashboard/invoices');
  redirect(`/dashboard/invoices/${createdId}`);
}

export async function setInvoiceStatus(
  _prev: InvoiceActionState,
  form: FormData,
): Promise<InvoiceActionState> {
  await requireRole(BILLING_ROLES);

  const parsed = InvoiceStatusSchema.safeParse({
    id: form.get('id'),
    version: form.get('version'),
    status: form.get('status'),
  });
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from('invoices')
    .select('status, version, total_pence, issued_at')
    .eq('id', parsed.data.id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!existing) return { status: 'error', message: 'Invoice not found' };

  const row = existing as {
    status: InvoiceStatus;
    version: number;
    total_pence: number;
    issued_at: string | null;
  };
  if (row.version !== parsed.data.version) {
    return { status: 'error', message: 'This invoice changed elsewhere. Reload and retry.' };
  }
  const next = parsed.data.status;
  if (next !== row.status && !canTransition(row.status, next)) {
    return { status: 'error', message: `Cannot move an invoice from ${row.status} to ${next}` };
  }

  const now = new Date().toISOString();
  const update: Record<string, unknown> = { status: next, version: parsed.data.version + 1 };
  if (next === 'sent' && !row.issued_at) update.issued_at = now;
  // Manual "paid" settles the balance; payment allocation supersedes this later.
  if (next === 'paid') update.amount_paid_pence = row.total_pence;

  const { data: saved, error } = await supabase
    .from('invoices')
    .update(update)
    .eq('id', parsed.data.id)
    .eq('version', parsed.data.version)
    .select('id, job_id')
    .maybeSingle();
  if (error || !saved) {
    return { status: 'error', message: 'Could not update the invoice. Reload and retry.' };
  }

  revalidatePath('/dashboard/invoices');
  revalidatePath(`/dashboard/invoices/${parsed.data.id}`);
  const jobId = (saved as { job_id: string | null }).job_id;
  if (jobId) revalidatePath(`/dashboard/jobs/${jobId}/invoices`);
  return { status: 'ok' };
}
