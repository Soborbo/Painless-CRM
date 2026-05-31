import {
  QUOTES_EXPORT_MAX,
  QUOTE_PAGE_SIZE,
  type QuoteListFilters,
  type QuoteStatus,
} from '@/lib/schemas/quote';
import { createClient } from '@/lib/supabase/server';

export interface QuoteRow {
  id: string;
  job_id: string;
  pricing_version_id: string;
  size_code: string | null;
  distance_miles: number | null;
  complications: string[] | null;
  total_pence: number;
  status: 'draft' | 'sent' | 'accepted' | 'declined' | 'expired' | null;
  valid_until: string;
  sent_at: string | null;
  created_at: string;
  version: number;
  revised_from_id: string | null;
  revision_number: number;
  first_opened_at: string | null;
  last_opened_at: string | null;
  open_count: number;
  declined_at: string | null;
  decline_reason: string | null;
  withdrawn_at: string | null;
  withdrawal_reason: string | null;
  withdrawn_by_name: string | null;
  pricing_version: { id: string; version_label: string } | null;
}

const QUOTE_LIST_COLUMNS = `
  id, job_id, pricing_version_id, size_code, distance_miles, complications,
  total_pence, status, valid_until, sent_at, created_at, version,
  revised_from_id, revision_number,
  first_opened_at, last_opened_at, open_count,
  declined_at, decline_reason,
  withdrawn_at, withdrawal_reason,
  withdrawn_by:users!quotes_withdrawn_by_user_id_fkey (full_name),
  pricing_version:pricing_versions!quotes_pricing_version_id_fkey (id, version_label)
`;

function flattenQuoteRow(raw: Record<string, unknown>): QuoteRow {
  const versionRaw = raw.pricing_version as unknown;
  const version = Array.isArray(versionRaw)
    ? ((versionRaw[0] as { id: string; version_label: string } | undefined) ?? null)
    : ((versionRaw as { id: string; version_label: string } | null) ?? null);
  const withdrawnByRaw = raw.withdrawn_by as unknown;
  const withdrawnBy = Array.isArray(withdrawnByRaw)
    ? ((withdrawnByRaw[0] as { full_name: string } | undefined) ?? null)
    : ((withdrawnByRaw as { full_name: string } | null) ?? null);
  return {
    id: raw.id as string,
    job_id: raw.job_id as string,
    pricing_version_id: raw.pricing_version_id as string,
    size_code: (raw.size_code as string | null) ?? null,
    distance_miles: (raw.distance_miles as number | null) ?? null,
    complications: (raw.complications as string[] | null) ?? null,
    total_pence: raw.total_pence as number,
    status: (raw.status as QuoteRow['status']) ?? null,
    valid_until: raw.valid_until as string,
    sent_at: (raw.sent_at as string | null) ?? null,
    created_at: raw.created_at as string,
    version: (raw.version as number | null) ?? 1,
    revised_from_id: (raw.revised_from_id as string | null) ?? null,
    revision_number: (raw.revision_number as number | null) ?? 1,
    first_opened_at: (raw.first_opened_at as string | null) ?? null,
    last_opened_at: (raw.last_opened_at as string | null) ?? null,
    open_count: (raw.open_count as number | null) ?? 0,
    declined_at: (raw.declined_at as string | null) ?? null,
    decline_reason: (raw.decline_reason as string | null) ?? null,
    withdrawn_at: (raw.withdrawn_at as string | null) ?? null,
    withdrawal_reason: (raw.withdrawal_reason as string | null) ?? null,
    withdrawn_by_name: withdrawnBy?.full_name ?? null,
    pricing_version: version,
  };
}

export interface QuoteRevisionSeed {
  id: string;
  job_id: string;
  size_code: string | null;
  distance_miles: number | null;
  complications: string[] | null;
  revision_number: number;
  total_pence: number;
}

export interface QuoteAcceptanceAudit {
  quote_id: string;
  accepted_at: string;
  acceptor_name: string | null;
  user_agent: string | null;
  variant_label: string | null;
  variant_total_pence: number | null;
}

export async function getJobAcceptanceAudits(jobId: string): Promise<QuoteAcceptanceAudit[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('quote_acceptances')
    .select(
      `quote_id, accepted_at, consents, user_agent,
       quote:quotes!inner(job_id),
       variant:quote_variants(variant_label, total_pence)`,
    )
    .eq('quote.job_id', jobId)
    .order('accepted_at', { ascending: false })
    .limit(50);
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
    const consents = (row.consents as { accepted_full_name?: string | null } | null) ?? null;
    const variantRaw = row.variant as unknown;
    const variant = Array.isArray(variantRaw)
      ? ((variantRaw[0] as { variant_label: string; total_pence: number } | undefined) ?? null)
      : ((variantRaw as { variant_label: string; total_pence: number } | null) ?? null);
    return {
      quote_id: row.quote_id as string,
      accepted_at: row.accepted_at as string,
      acceptor_name: consents?.accepted_full_name ?? null,
      user_agent: (row.user_agent as string | null) ?? null,
      variant_label: variant?.variant_label ?? null,
      variant_total_pence: variant?.total_pence ?? null,
    };
  });
}

export interface QuoteAcceptanceDetail {
  accepted_at: string;
  acceptor_name: string | null;
  variant_id: string | null;
  variant_label: string | null;
  variant_total_pence: number | null;
}

// Pure flatten helper — exported for unit testing without a live Supabase
// connection. Quote-acceptances rows arrive with the joined variant either as
// a single object or a one-element array depending on PostgREST embedding,
// so the caller normalises both shapes.
export function flattenQuoteAcceptanceRow(
  raw: Record<string, unknown> | null | undefined,
): QuoteAcceptanceDetail | null {
  if (!raw) return null;
  const consents = (raw.consents as { accepted_full_name?: string | null } | null) ?? null;
  const variantRaw = raw.variant as unknown;
  const variant = Array.isArray(variantRaw)
    ? ((variantRaw[0] as { id: string; variant_label: string; total_pence: number } | undefined) ??
      null)
    : ((variantRaw as { id: string; variant_label: string; total_pence: number } | null) ?? null);
  return {
    accepted_at: raw.accepted_at as string,
    acceptor_name: consents?.accepted_full_name ?? null,
    variant_id: variant?.id ?? null,
    variant_label: variant?.variant_label ?? null,
    variant_total_pence: variant?.total_pence ?? null,
  };
}

export async function getQuoteAcceptance(
  jobId: string,
  quoteId: string,
): Promise<QuoteAcceptanceDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('quote_acceptances')
    .select(
      `accepted_at, consents,
       quote:quotes!inner(job_id),
       variant:quote_variants(id, variant_label, total_pence)`,
    )
    .eq('quote_id', quoteId)
    .eq('quote.job_id', jobId)
    .order('accepted_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return flattenQuoteAcceptanceRow(data as Record<string, unknown> | null);
}

export async function getQuoteRevisionSeed(
  jobId: string,
  quoteId: string,
): Promise<QuoteRevisionSeed | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('quotes')
    .select('id, job_id, size_code, distance_miles, complications, revision_number, total_pence')
    .eq('id', quoteId)
    .eq('job_id', jobId)
    .is('deleted_at', null)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id as string,
    job_id: data.job_id as string,
    size_code: (data.size_code as string | null) ?? null,
    distance_miles: (data.distance_miles as number | null) ?? null,
    complications: (data.complications as string[] | null) ?? null,
    revision_number: (data.revision_number as number | null) ?? 1,
    total_pence: (data.total_pence as number | null) ?? 0,
  };
}

export async function listQuotesForJob(jobId: string): Promise<QuoteRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('quotes')
    .select(QUOTE_LIST_COLUMNS)
    .eq('job_id', jobId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(50);
  return ((data ?? []) as Array<Record<string, unknown>>).map(flattenQuoteRow);
}

export type QuoteValidityStatus = 'expired' | 'expiring_soon' | 'fresh';

const SOON_HOURS = 24;

export function classifyQuoteValidity(
  validUntil: string,
  now: Date = new Date(),
): QuoteValidityStatus {
  const due = new Date(validUntil).getTime();
  if (Number.isNaN(due)) return 'expired';
  const remainingMs = due - now.getTime();
  if (remainingMs <= 0) return 'expired';
  if (remainingMs <= SOON_HOURS * 60 * 60 * 1000) return 'expiring_soon';
  return 'fresh';
}

// =====================================================
// Office-wide quotes list + CSV export (Phase 06b §8)
// =====================================================

export interface QuoteListCustomer {
  customer_type: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  primary_email: string | null;
}

export interface QuoteListItem {
  id: string;
  job_id: string;
  job_number: string;
  move_date: string | null;
  status: QuoteStatus | null;
  total_pence: number;
  valid_until: string;
  sent_at: string | null;
  declined_at: string | null;
  withdrawn_at: string | null;
  revision_number: number;
  open_count: number;
  created_at: string;
  customer: QuoteListCustomer | null;
}

// The job embed is !inner so a job_number search (.ilike on job.job_number)
// actually prunes the quote rows rather than just nulling the embed — see the
// global-search read. Every quote has a non-null job_id, so the inner join
// never drops a row when no search is applied.
const QUOTE_OFFICE_COLUMNS = `
  id, job_id, status, total_pence, valid_until, sent_at,
  declined_at, withdrawn_at, revision_number, open_count, created_at,
  job:jobs!inner (
    job_number, move_date,
    customer:customers (customer_type, first_name, last_name, company_name, primary_email)
  )
`;

// Builds the ilike pattern for a job-number search, stripping LIKE
// metacharacters so user input can't change the match shape.
function jobNumberPattern(q: string): string {
  return `%${q.replace(/[%_,]/g, ' ')}%`;
}

// PostgREST embeds a to-one relation as either a single object or a
// one-element array depending on the inferred cardinality — normalise both.
function embedOne<T>(raw: unknown): T | null {
  if (Array.isArray(raw)) return (raw[0] as T | undefined) ?? null;
  return (raw as T | null) ?? null;
}

// Pure flatten — exported so the join-shape normalisation is unit-testable
// without a live Supabase connection.
export function flattenQuoteListItem(raw: Record<string, unknown>): QuoteListItem {
  const job = embedOne<{
    job_number?: string;
    move_date?: string | null;
    customer?: unknown;
  }>(raw.job);
  const customer = embedOne<QuoteListCustomer>(job?.customer);
  return {
    id: raw.id as string,
    job_id: raw.job_id as string,
    job_number: job?.job_number ?? '—',
    move_date: job?.move_date ?? null,
    status: (raw.status as QuoteStatus | null) ?? null,
    total_pence: (raw.total_pence as number | null) ?? 0,
    valid_until: raw.valid_until as string,
    sent_at: (raw.sent_at as string | null) ?? null,
    declined_at: (raw.declined_at as string | null) ?? null,
    withdrawn_at: (raw.withdrawn_at as string | null) ?? null,
    revision_number: (raw.revision_number as number | null) ?? 1,
    open_count: (raw.open_count as number | null) ?? 0,
    created_at: raw.created_at as string,
    customer,
  };
}

export interface QuoteListResult {
  rows: QuoteListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export async function listQuotes(filters: QuoteListFilters): Promise<QuoteListResult> {
  const supabase = await createClient();
  const from = (filters.page - 1) * QUOTE_PAGE_SIZE;
  const to = from + QUOTE_PAGE_SIZE - 1;

  let query = supabase
    .from('quotes')
    .select(QUOTE_OFFICE_COLUMNS, { count: 'exact' })
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (filters.status) query = query.eq('status', filters.status);
  if (filters.created_from)
    query = query.gte('created_at', `${filters.created_from}T00:00:00.000Z`);
  if (filters.created_to) query = query.lte('created_at', `${filters.created_to}T23:59:59.999Z`);
  if (filters.q) query = query.ilike('job.job_number', jobNumberPattern(filters.q));

  const { data, count } = await query;
  return {
    rows: ((data ?? []) as Array<Record<string, unknown>>).map(flattenQuoteListItem),
    total: count ?? 0,
    page: filters.page,
    pageSize: QUOTE_PAGE_SIZE,
  };
}

export async function listQuotesForExport(
  filters: Omit<QuoteListFilters, 'page'>,
): Promise<QuoteListItem[]> {
  const supabase = await createClient();
  let query = supabase
    .from('quotes')
    .select(QUOTE_OFFICE_COLUMNS)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(QUOTES_EXPORT_MAX);

  if (filters.status) query = query.eq('status', filters.status);
  if (filters.created_from)
    query = query.gte('created_at', `${filters.created_from}T00:00:00.000Z`);
  if (filters.created_to) query = query.lte('created_at', `${filters.created_to}T23:59:59.999Z`);
  if (filters.q) query = query.ilike('job.job_number', jobNumberPattern(filters.q));

  const { data } = await query;
  return ((data ?? []) as Array<Record<string, unknown>>).map(flattenQuoteListItem);
}
