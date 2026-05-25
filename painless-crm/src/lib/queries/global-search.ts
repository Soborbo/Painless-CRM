import { createClient } from '@/lib/supabase/server';

// Phase 06b §3 — global search backbone. Returns the top matches per
// entity type so the popover can render groups. RLS scopes the read
// to the caller's company on every table.
//
// v0.1 uses ilike across name/email/phone/job_number. pg_trgm indexes
// are in place on `customers`; jobs and quotes fall back to a plain
// LIKE plan which is fine at Painless's scale (<5k jobs). Bigger
// indexes can land later without changing this contract.

const ILIKE_ESCAPE = /[%_,]/g;

export function sanitizeIlikePattern(input: string): string {
  return input.replace(ILIKE_ESCAPE, ' ').trim();
}

export const GLOBAL_SEARCH_MIN_LEN = 2;
export const GLOBAL_SEARCH_MAX_LEN = 100;

export interface CustomerHit {
  kind: 'customer';
  id: string;
  customer_type: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  primary_email: string | null;
  primary_phone: string | null;
}

export interface JobHit {
  kind: 'job';
  id: string;
  job_number: string;
  stage: string;
  customer: {
    first_name: string | null;
    last_name: string | null;
    company_name: string | null;
  } | null;
}

export interface QuoteHit {
  kind: 'quote';
  id: string;
  job_id: string;
  status: string | null;
  total_pence: number;
  created_at: string;
  job: { job_number: string } | null;
}

export interface GlobalSearchResults {
  customers: CustomerHit[];
  jobs: JobHit[];
  quotes: QuoteHit[];
  query: string;
}

const EMPTY: Omit<GlobalSearchResults, 'query'> = {
  customers: [],
  jobs: [],
  quotes: [],
};

async function findCustomers(q: string): Promise<CustomerHit[]> {
  const supabase = await createClient();
  const pattern = `%${q}%`;
  const { data } = await supabase
    .from('customers')
    .select('id, customer_type, first_name, last_name, company_name, primary_email, primary_phone')
    .is('deleted_at', null)
    .or(
      [
        `first_name.ilike.${pattern}`,
        `last_name.ilike.${pattern}`,
        `company_name.ilike.${pattern}`,
        `primary_email.ilike.${pattern}`,
        `primary_phone.ilike.${pattern}`,
      ].join(','),
    )
    .order('updated_at', { ascending: false })
    .limit(5);
  return (data ?? []).map((row) => ({ kind: 'customer' as const, ...row })) as CustomerHit[];
}

async function findJobs(q: string): Promise<JobHit[]> {
  const supabase = await createClient();
  const pattern = `%${q}%`;
  const { data } = await supabase
    .from('jobs')
    .select('id, job_number, stage, customer:customers (first_name, last_name, company_name)')
    .is('deleted_at', null)
    .or([`job_number.ilike.${pattern}`, `notes.ilike.${pattern}`].join(','))
    .order('updated_at', { ascending: false })
    .limit(5);
  return (data ?? []).map((row) => ({ kind: 'job' as const, ...row })) as unknown as JobHit[];
}

async function findQuotes(q: string): Promise<QuoteHit[]> {
  const supabase = await createClient();
  const pattern = `%${q}%`;
  const { data } = await supabase
    .from('quotes')
    .select('id, job_id, status, total_pence, created_at, job:jobs (job_number)')
    .is('deleted_at', null)
    .ilike('job.job_number', pattern)
    .order('created_at', { ascending: false })
    .limit(3);
  return (data ?? []).map((row) => ({ kind: 'quote' as const, ...row })) as unknown as QuoteHit[];
}

export async function runGlobalSearch(rawQuery: string): Promise<GlobalSearchResults> {
  const q = sanitizeIlikePattern(rawQuery);
  if (q.length < GLOBAL_SEARCH_MIN_LEN) return { ...EMPTY, query: q };
  const trimmed = q.slice(0, GLOBAL_SEARCH_MAX_LEN);
  const [customers, jobs, quotes] = await Promise.all([
    findCustomers(trimmed),
    findJobs(trimmed),
    findQuotes(trimmed),
  ]);
  return { customers, jobs, quotes, query: trimmed };
}
