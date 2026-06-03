import type { createClient } from '@/lib/supabase/server';

// Phase 12 — shared invoice creation, usable from a server action (RLS-scoped)
// or the admin client (public quote-acceptance flow). Numbering filters
// company_id EXPLICITLY so it's correct even when RLS is bypassed.

// Loosened client type so both the cookie server client and the admin client fit.
type AnyClient = Awaited<ReturnType<typeof createClient>>;

const DEFAULT_PREFIX = 'PR';

export async function nextInvoiceNumber(supabase: AnyClient, companyId: string): Promise<string> {
  const year = new Date().getUTCFullYear();

  const { data: settings } = await supabase
    .from('settings')
    .select('feature_flags')
    .eq('company_id', companyId)
    .maybeSingle();
  const flags = (settings as { feature_flags: Record<string, unknown> | null } | null)
    ?.feature_flags;
  const prefix =
    typeof flags?.invoice_prefix === 'string' && flags.invoice_prefix
      ? flags.invoice_prefix
      : DEFAULT_PREFIX;

  // Compute the next sequence as a NUMERIC max, not a string sort. Ordering
  // invoice_number DESC lexicographically put 'PR-2026-9999' above
  // 'PR-2026-10000', so a company past 9999/year jammed on a duplicate-number
  // retry loop (audit). Fetch the year's numbers and max their trailing integer.
  const { data } = await supabase
    .from('invoices')
    .select('invoice_number')
    .eq('company_id', companyId)
    .ilike('invoice_number', `${prefix}-${year}-%`);

  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`^${escapedPrefix}-\\d{4}-(\\d+)$`);
  let maxSeq = 0;
  for (const row of (data ?? []) as Array<{ invoice_number: string }>) {
    const match = re.exec(row.invoice_number);
    if (match?.[1]) {
      const seq = Number.parseInt(match[1], 10);
      if (seq > maxSeq) maxSeq = seq;
    }
  }
  return `${prefix}-${year}-${String(maxSeq + 1).padStart(4, '0')}`;
}

export interface CreateInvoiceParams {
  company_id: string;
  customer_id: string;
  job_id: string | null;
  type: 'deposit' | 'custom' | 'final' | 'credit_note';
  description: string;
  amount_pence: number; // line ex-VAT amount
  vat_rate?: number; // percent; 0 when the quote total is already gross
  created_by_id?: string | null;
  due_at?: string | null;
}

// Creates a draft invoice with a single line, retrying once on the
// (company_id, invoice_number) unique index. Returns the new id, or null.
export async function createInvoiceWithLine(
  supabase: AnyClient,
  params: CreateInvoiceParams,
): Promise<string | null> {
  const vatRate = params.vat_rate ?? 0;
  const subtotal = params.amount_pence;
  const vat = Math.round((subtotal * vatRate) / 100);
  const total = subtotal + vat;

  let invoiceId: string | null = null;
  for (let attempt = 0; attempt < 2 && !invoiceId; attempt++) {
    const invoiceNumber = await nextInvoiceNumber(supabase, params.company_id);
    const { data, error } = await supabase
      .from('invoices')
      .insert({
        company_id: params.company_id,
        customer_id: params.customer_id,
        job_id: params.job_id,
        invoice_number: invoiceNumber,
        type: params.type,
        status: 'draft',
        subtotal_pence: subtotal,
        vat_pence: vat,
        total_pence: total,
        due_at: params.due_at ?? null,
        created_by_id: params.created_by_id ?? null,
      })
      .select('id')
      .single();
    if (!error && data) {
      invoiceId = (data as { id: string }).id;
      break;
    }
    if (error && error.code !== '23505') return null;
  }
  if (!invoiceId) return null;

  const { error: lineError } = await supabase.from('invoice_lines').insert({
    invoice_id: invoiceId,
    description: params.description,
    quantity: 1,
    unit_price_pence: params.amount_pence,
    vat_rate: vatRate,
    line_total_pence: params.amount_pence,
  });
  if (lineError) return null;
  return invoiceId;
}

// True when the job already has a live invoice of this type (idempotency guard
// for the auto-create hooks).
export async function jobHasInvoiceOfType(
  supabase: AnyClient,
  jobId: string,
  type: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('invoices')
    .select('id')
    .eq('job_id', jobId)
    .eq('type', type)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}
