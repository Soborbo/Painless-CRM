import { createClient } from '@/lib/supabase/server';

// Detail-page loader for a single quote, scoped by RLS to the rep's tenant.
// Pulls everything the rep needs to defend the price internally — full
// snapshot (including margin %), engine components, and the validity /
// audit timestamps — but stays separate from the public-quote loader to
// keep the customer-safe and rep-internal surfaces from drifting toward
// the same shape.

export interface QuoteDetailRow {
  id: string;
  job_id: string;
  status: 'draft' | 'sent' | 'accepted' | 'declined' | 'expired' | null;
  total_pence: number;
  size_code: string | null;
  distance_miles: number | null;
  complications: string[] | null;
  valid_until: string;
  sent_at: string | null;
  declined_at: string | null;
  decline_reason: string | null;
  withdrawn_at: string | null;
  withdrawal_reason: string | null;
  withdrawn_by_name: string | null;
  first_opened_at: string | null;
  last_opened_at: string | null;
  open_count: number;
  revision_number: number;
  revised_from_id: string | null;
  pricing_version: { id: string; version_label: string } | null;
  created_at: string;
  pricing_snapshot: Record<string, unknown> | null;
  breakdown: Record<string, unknown> | null;
  acceptance: QuoteAcceptanceSummary | null;
}

export interface QuoteAcceptanceSummary {
  accepted_at: string;
  acceptor_name: string | null;
  variant_label: string | null;
}

export async function getQuoteDetail(
  jobId: string,
  quoteId: string,
): Promise<QuoteDetailRow | null> {
  const supabase = await createClient();
  const [{ data }, acceptanceResult] = await Promise.all([
    supabase
      .from('quotes')
      .select(
        `id, job_id, status, total_pence, size_code, distance_miles, complications,
         valid_until, sent_at, declined_at, decline_reason, withdrawn_at, withdrawal_reason,
         first_opened_at, last_opened_at, open_count,
         revision_number, revised_from_id, created_at,
         pricing_snapshot, breakdown,
         withdrawn_by:users!quotes_withdrawn_by_user_id_fkey (full_name),
         pricing_version:pricing_versions!quotes_pricing_version_id_fkey (id, version_label)`,
      )
      .eq('id', quoteId)
      .eq('job_id', jobId)
      .is('deleted_at', null)
      .maybeSingle(),
    supabase
      .from('quote_acceptances')
      .select('accepted_at, consents, variant:quote_variants(variant_label)')
      .eq('quote_id', quoteId)
      .order('accepted_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (!data) return null;
  const row = data as Record<string, unknown>;
  const versionRaw = row.pricing_version as unknown;
  const version = Array.isArray(versionRaw)
    ? ((versionRaw[0] as { id: string; version_label: string } | undefined) ?? null)
    : ((versionRaw as { id: string; version_label: string } | null) ?? null);
  const withdrawnByRaw = row.withdrawn_by as unknown;
  const withdrawnBy = Array.isArray(withdrawnByRaw)
    ? ((withdrawnByRaw[0] as { full_name: string } | undefined) ?? null)
    : ((withdrawnByRaw as { full_name: string } | null) ?? null);
  return {
    id: row.id as string,
    job_id: row.job_id as string,
    status: (row.status as QuoteDetailRow['status']) ?? null,
    total_pence: row.total_pence as number,
    size_code: (row.size_code as string | null) ?? null,
    distance_miles: (row.distance_miles as number | null) ?? null,
    complications: (row.complications as string[] | null) ?? null,
    valid_until: row.valid_until as string,
    sent_at: (row.sent_at as string | null) ?? null,
    declined_at: (row.declined_at as string | null) ?? null,
    decline_reason: (row.decline_reason as string | null) ?? null,
    withdrawn_at: (row.withdrawn_at as string | null) ?? null,
    withdrawal_reason: (row.withdrawal_reason as string | null) ?? null,
    withdrawn_by_name: withdrawnBy?.full_name ?? null,
    first_opened_at: (row.first_opened_at as string | null) ?? null,
    last_opened_at: (row.last_opened_at as string | null) ?? null,
    open_count: (row.open_count as number | null) ?? 0,
    revision_number: (row.revision_number as number | null) ?? 1,
    revised_from_id: (row.revised_from_id as string | null) ?? null,
    pricing_version: version,
    created_at: row.created_at as string,
    pricing_snapshot: (row.pricing_snapshot as Record<string, unknown> | null) ?? null,
    breakdown: (row.breakdown as Record<string, unknown> | null) ?? null,
    acceptance: flattenAcceptance(acceptanceResult.data),
  };
}

function flattenAcceptance(raw: unknown): QuoteAcceptanceSummary | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const consents = (row.consents as { accepted_full_name?: string | null } | null) ?? null;
  const variantRaw = row.variant as unknown;
  const variant = Array.isArray(variantRaw)
    ? ((variantRaw[0] as { variant_label: string } | undefined) ?? null)
    : ((variantRaw as { variant_label: string } | null) ?? null);
  return {
    accepted_at: row.accepted_at as string,
    acceptor_name: consents?.accepted_full_name ?? null,
    variant_label: variant?.variant_label ?? null,
  };
}
