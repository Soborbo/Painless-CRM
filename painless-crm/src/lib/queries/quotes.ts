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
  pricing_version: { id: string; version_label: string } | null;
}

const QUOTE_LIST_COLUMNS = `
  id, job_id, pricing_version_id, size_code, distance_miles, complications,
  total_pence, status, valid_until, sent_at, created_at, version,
  pricing_version:pricing_versions!quotes_pricing_version_id_fkey (id, version_label)
`;

function flattenQuoteRow(raw: Record<string, unknown>): QuoteRow {
  const versionRaw = raw.pricing_version as unknown;
  const version = Array.isArray(versionRaw)
    ? ((versionRaw[0] as { id: string; version_label: string } | undefined) ?? null)
    : ((versionRaw as { id: string; version_label: string } | null) ?? null);
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
    pricing_version: version,
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
