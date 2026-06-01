import { createClient } from '@/lib/supabase/server';
import { customerDisplayName } from '@/lib/utils/format';

// Phase 12 — invoice reads + numbering. RLS scopes to the company.

const DEFAULT_PREFIX = 'PR';

export interface InvoiceListRow {
  id: string;
  invoice_number: string;
  type: string | null;
  status: string | null;
  total_pence: number;
  amount_outstanding_pence: number | null;
  customer_name: string;
  job_id: string | null;
  due_at: string | null;
  created_at: string;
}

export interface InvoiceLineRow {
  id: string;
  description: string;
  quantity: number;
  unit_price_pence: number;
  vat_rate: number;
  line_total_pence: number;
}

export interface InvoiceDetail extends InvoiceListRow {
  subtotal_pence: number;
  vat_pence: number;
  amount_paid_pence: number | null;
  issued_at: string | null;
  version: number;
  lines: InvoiceLineRow[];
}

const LIST_SELECT =
  'id, invoice_number, type, status, total_pence, amount_outstanding_pence, job_id, due_at, created_at, ' +
  'customer:customers(customer_type, first_name, last_name, company_name, primary_email)';

function embed<T>(raw: unknown): T | null {
  if (Array.isArray(raw)) return (raw[0] as T) ?? null;
  return (raw as T) ?? null;
}

function toListRow(raw: Record<string, unknown>): InvoiceListRow {
  const customer = embed<Parameters<typeof customerDisplayName>[0]>(raw.customer);
  return {
    id: raw.id as string,
    invoice_number: raw.invoice_number as string,
    type: (raw.type as string | null) ?? null,
    status: (raw.status as string | null) ?? null,
    total_pence: (raw.total_pence as number) ?? 0,
    amount_outstanding_pence: (raw.amount_outstanding_pence as number | null) ?? null,
    customer_name: customer ? customerDisplayName(customer) : 'Unknown customer',
    job_id: (raw.job_id as string | null) ?? null,
    due_at: (raw.due_at as string | null) ?? null,
    created_at: raw.created_at as string,
  };
}

// Sequential per company per year: {PREFIX}-{YYYY}-{NNNN}. Prefix from
// settings.feature_flags.invoice_prefix, else 'PR'. The (company_id,
// invoice_number) unique index is the real race guard; the action retries once.
export async function getNextInvoiceNumber(companyId: string): Promise<string> {
  const supabase = await createClient();
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

  const { data } = await supabase
    .from('invoices')
    .select('invoice_number')
    .ilike('invoice_number', `${prefix}-${year}-%`)
    .order('invoice_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  let next = 1;
  const current = (data as { invoice_number: string } | null)?.invoice_number;
  if (current) {
    const match = new RegExp(`${prefix}-\\d{4}-(\\d+)`).exec(current);
    if (match?.[1]) next = Number.parseInt(match[1], 10) + 1;
  }
  return `${prefix}-${year}-${String(next).padStart(4, '0')}`;
}

export async function listInvoices(): Promise<InvoiceListRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('invoices')
    .select(LIST_SELECT)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(500);
  return ((data ?? []) as unknown as Array<Record<string, unknown>>).map(toListRow);
}

export async function getInvoicesForJob(jobId: string): Promise<InvoiceListRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('invoices')
    .select(LIST_SELECT)
    .eq('job_id', jobId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  return ((data ?? []) as unknown as Array<Record<string, unknown>>).map(toListRow);
}

export interface InvoicePaymentRow {
  id: string;
  amount_pence: number;
  method: string | null;
  occurred_at: string;
  reference: string | null;
}

// Payments allocated to an invoice (the payment_to_invoice slice of each).
export async function getPaymentsForInvoice(invoiceId: string): Promise<InvoicePaymentRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('payment_allocations')
    .select('amount_pence, payment:payments(id, method, occurred_at, reference)')
    .eq('invoice_id', invoiceId)
    .eq('allocation_type', 'payment_to_invoice')
    .order('allocated_at', { ascending: false });
  return ((data ?? []) as unknown as Array<Record<string, unknown>>).map((raw) => {
    const payment = embed<{
      id: string;
      method: string | null;
      occurred_at: string;
      reference: string | null;
    }>(raw.payment);
    return {
      id: payment?.id ?? '',
      amount_pence: (raw.amount_pence as number) ?? 0,
      method: payment?.method ?? null,
      occurred_at: payment?.occurred_at ?? '',
      reference: payment?.reference ?? null,
    };
  });
}

export async function getInvoice(id: string): Promise<InvoiceDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('invoices')
    .select(`${LIST_SELECT}, subtotal_pence, vat_pence, amount_paid_pence, issued_at, version`)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!data) return null;

  const { data: lineRows } = await supabase
    .from('invoice_lines')
    .select('id, description, quantity, unit_price_pence, vat_rate, line_total_pence')
    .eq('invoice_id', id)
    .is('deleted_at', null)
    .order('sort_order', { ascending: true });

  const raw = data as unknown as Record<string, unknown>;
  return {
    ...toListRow(raw),
    subtotal_pence: (raw.subtotal_pence as number) ?? 0,
    vat_pence: (raw.vat_pence as number) ?? 0,
    amount_paid_pence: (raw.amount_paid_pence as number | null) ?? null,
    issued_at: (raw.issued_at as string | null) ?? null,
    version: (raw.version as number) ?? 1,
    lines: (lineRows ?? []) as InvoiceLineRow[],
  };
}
