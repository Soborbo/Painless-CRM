import { createAdminClient } from '@/lib/supabase/admin';

// Anonymous, token-gated reads of a quote for the public acceptance page.
// Uses the admin client because the customer is not signed in; the caller
// MUST have already verified the share token before invoking these helpers.
// Returns the minimum surface needed to render the acceptance page — no
// pricing matrix, no internal notes, no other quotes on the same job.

export interface PublicQuote {
  id: string;
  company_id: string;
  job_id: string;
  status: 'draft' | 'sent' | 'accepted' | 'declined' | 'expired';
  total_pence: number;
  valid_until: string;
  size_code: string | null;
  distance_miles: number | null;
  complications: string[] | null;
  breakdown: Record<string, unknown> | null;
  customer: {
    id: string;
    display_name: string;
  };
  job: {
    job_number: string;
    move_date: string | null;
  };
  company: {
    name: string;
  };
  pricing_version_label: string;
}

interface RawRow {
  id: string;
  company_id: string;
  job_id: string;
  status: PublicQuote['status'] | null;
  total_pence: number;
  valid_until: string;
  size_code: string | null;
  distance_miles: number | null;
  complications: string[] | null;
  breakdown: Record<string, unknown> | null;
  pricing_version: { version_label: string } | null;
  job: {
    job_number: string;
    move_date: string | null;
    customer: {
      id: string;
      customer_type: string | null;
      first_name: string | null;
      last_name: string | null;
      company_name: string | null;
    } | null;
    company: { name: string } | null;
  } | null;
}

function displayName(c: NonNullable<NonNullable<RawRow['job']>['customer']>): string {
  if (c.customer_type === 'business' && c.company_name) return c.company_name;
  const name = [c.first_name, c.last_name].filter(Boolean).join(' ');
  return name || 'Customer';
}

export async function getPublicQuoteById(id: string): Promise<PublicQuote | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('quotes')
    .select(
      `id, company_id, job_id, status, total_pence, valid_until, size_code,
       distance_miles, complications, breakdown,
       pricing_version:pricing_versions!quotes_pricing_version_id_fkey (version_label),
       job:jobs!quotes_job_id_fkey (
         job_number, move_date,
         customer:customers!jobs_customer_id_fkey (id, customer_type, first_name, last_name, company_name),
         company:companies!jobs_company_id_fkey (name)
       )`,
    )
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!data) return null;

  const row = data as unknown as RawRow;
  if (!row.job?.customer) return null;
  return {
    id: row.id,
    company_id: row.company_id,
    job_id: row.job_id,
    status: row.status ?? 'draft',
    total_pence: row.total_pence,
    valid_until: row.valid_until,
    size_code: row.size_code,
    distance_miles: row.distance_miles,
    complications: row.complications,
    breakdown: row.breakdown,
    customer: { id: row.job.customer.id, display_name: displayName(row.job.customer) },
    job: { job_number: row.job.job_number, move_date: row.job.move_date },
    company: { name: row.job.company?.name ?? 'Painless Removals' },
    pricing_version_label: row.pricing_version?.version_label ?? '—',
  };
}
