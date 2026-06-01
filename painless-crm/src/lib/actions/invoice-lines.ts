'use server';

import { requireRole } from '@/lib/auth/require-role';
import { type InvoiceStatus, isEditable } from '@/lib/invoices/status';
import { computeInvoiceTotals, lineSubtotalPence } from '@/lib/invoices/totals';
import { InvoiceLineSchema } from '@/lib/schemas/invoice';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

const BILLING_ROLES = ['accounts', 'manager', 'admin', 'super_admin'] as const;

export type InvoiceLineActionState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'ok' };

export const INITIAL_INVOICE_LINE_STATE: InvoiceLineActionState = { status: 'idle' };

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// Re-derives the invoice's stored subtotal/vat/total from its live lines.
async function recomputeTotals(supabase: SupabaseServerClient, invoiceId: string): Promise<void> {
  const { data: lines } = await supabase
    .from('invoice_lines')
    .select('quantity, unit_price_pence, vat_rate')
    .eq('invoice_id', invoiceId)
    .is('deleted_at', null);
  const totals = computeInvoiceTotals(
    ((lines ?? []) as Array<{ quantity: number; unit_price_pence: number; vat_rate: number }>).map(
      (l) => ({
        quantity: l.quantity,
        unit_price_pence: l.unit_price_pence,
        vat_rate: l.vat_rate ?? 0,
      }),
    ),
  );
  await supabase.from('invoices').update(totals).eq('id', invoiceId);
}

// Confirms the invoice exists, is a live draft (editable), and returns its job.
async function editableInvoice(
  supabase: SupabaseServerClient,
  invoiceId: string,
): Promise<{ job_id: string | null } | 'not_found' | 'locked'> {
  const { data } = await supabase
    .from('invoices')
    .select('status, job_id')
    .eq('id', invoiceId)
    .is('deleted_at', null)
    .maybeSingle();
  if (!data) return 'not_found';
  const row = data as { status: InvoiceStatus; job_id: string | null };
  if (!isEditable(row.status)) return 'locked';
  return { job_id: row.job_id };
}

export async function addInvoiceLine(
  _prev: InvoiceLineActionState,
  form: FormData,
): Promise<InvoiceLineActionState> {
  await requireRole(BILLING_ROLES);

  const parsed = InvoiceLineSchema.safeParse({
    invoice_id: form.get('invoice_id'),
    description: form.get('description'),
    quantity: form.get('quantity') || undefined,
    unit_price_pounds: form.get('unit_price_pounds'),
    vat_rate: form.get('vat_rate') || undefined,
  });
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const supabase = await createClient();
  const guard = await editableInvoice(supabase, parsed.data.invoice_id);
  if (guard === 'not_found') return { status: 'error', message: 'Invoice not found' };
  if (guard === 'locked') return { status: 'error', message: 'Only draft invoices can be edited' };

  const unitPence = Math.round(parsed.data.unit_price_pounds * 100);
  const { error } = await supabase.from('invoice_lines').insert({
    invoice_id: parsed.data.invoice_id,
    description: parsed.data.description,
    quantity: parsed.data.quantity,
    unit_price_pence: unitPence,
    vat_rate: parsed.data.vat_rate,
    line_total_pence: lineSubtotalPence(parsed.data.quantity, unitPence),
  });
  if (error) return { status: 'error', message: 'Could not add the line' };

  await recomputeTotals(supabase, parsed.data.invoice_id);
  revalidatePath(`/dashboard/invoices/${parsed.data.invoice_id}`);
  return { status: 'ok' };
}

export async function removeInvoiceLine(
  _prev: InvoiceLineActionState,
  form: FormData,
): Promise<InvoiceLineActionState> {
  await requireRole(BILLING_ROLES);
  const id = form.get('id');
  const invoiceId = form.get('invoice_id');
  if (typeof id !== 'string' || typeof invoiceId !== 'string') {
    return { status: 'error', message: 'Missing fields' };
  }

  const supabase = await createClient();
  const guard = await editableInvoice(supabase, invoiceId);
  if (guard === 'not_found') return { status: 'error', message: 'Invoice not found' };
  if (guard === 'locked') return { status: 'error', message: 'Only draft invoices can be edited' };

  const { error } = await supabase
    .from('invoice_lines')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('invoice_id', invoiceId)
    .is('deleted_at', null);
  if (error) return { status: 'error', message: 'Could not remove the line' };

  await recomputeTotals(supabase, invoiceId);
  revalidatePath(`/dashboard/invoices/${invoiceId}`);
  return { status: 'ok' };
}
