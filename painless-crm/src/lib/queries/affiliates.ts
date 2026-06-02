import { AFFILIATE_PAGE_SIZE, type AffiliateListFilters } from '@/lib/schemas/affiliate';
import { createClient } from '@/lib/supabase/server';

export type AffiliateRow = {
  id: string;
  name: string;
  type: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  commission_type: string | null;
  commission_value: number | null;
  commission_config: unknown;
  active: boolean | null;
  created_at: string;
  updated_at: string;
  version: number;
};

export type AffiliateCodeRow = {
  id: string;
  code: string;
  active: boolean | null;
  created_at: string;
};

export type AffiliateListResult = {
  rows: AffiliateRow[];
  total: number;
  page: number;
  pageSize: number;
};

const COLUMNS =
  'id, name, type, contact_name, contact_email, contact_phone, commission_type, commission_value, commission_config, active, created_at, updated_at, version';

export async function listAffiliates(filters: AffiliateListFilters): Promise<AffiliateListResult> {
  const supabase = await createClient();
  const from = (filters.page - 1) * AFFILIATE_PAGE_SIZE;
  const to = from + AFFILIATE_PAGE_SIZE - 1;

  let query = supabase
    .from('affiliates')
    .select(COLUMNS, { count: 'exact' })
    .is('deleted_at', null)
    .order('name', { ascending: true })
    .range(from, to);

  if (filters.status === 'active') query = query.eq('active', true);
  if (filters.status === 'pending') query = query.eq('active', false);

  const { data, count } = await query;
  return {
    rows: (data ?? []) as AffiliateRow[],
    total: count ?? 0,
    page: filters.page,
    pageSize: AFFILIATE_PAGE_SIZE,
  };
}

export async function getAffiliateById(id: string): Promise<AffiliateRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('affiliates')
    .select(COLUMNS)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  return (data as AffiliateRow | null) ?? null;
}

export async function listAffiliateCodes(affiliateId: string): Promise<AffiliateCodeRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('affiliate_codes')
    .select('id, code, active, created_at')
    .eq('affiliate_id', affiliateId)
    .order('created_at', { ascending: true });
  return (data ?? []) as AffiliateCodeRow[];
}

export type AffiliateReferralSummary = {
  customers: number;
  jobs: number;
  wonJobs: number;
};

// Referral counts straight off `attributions` + the won flag (jobs.paid_at).
export async function getAffiliateReferralSummary(
  affiliateId: string,
): Promise<AffiliateReferralSummary> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('attributions')
    .select('customer_id, job:jobs!attributions_job_id_fkey (id, paid_at, deleted_at)')
    .eq('affiliate_id', affiliateId);
  const rows = (data ?? []) as unknown as Array<{
    customer_id: string | null;
    job: { id: string; paid_at: string | null; deleted_at: string | null } | null;
  }>;
  const customers = new Set<string>();
  const jobs = new Set<string>();
  let wonJobs = 0;
  for (const r of rows) {
    if (r.customer_id) customers.add(r.customer_id);
    if (r.job && !r.job.deleted_at) {
      jobs.add(r.job.id);
      if (r.job.paid_at) wonJobs += 1;
    }
  }
  return { customers: customers.size, jobs: jobs.size, wonJobs };
}
