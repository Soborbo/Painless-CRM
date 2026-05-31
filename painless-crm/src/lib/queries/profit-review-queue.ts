import { createClient } from '@/lib/supabase/server';

// Profit-review backlog (Phase 06b §2 + §10). Lists every job awaiting a
// profit review, regardless of when it completed — the profit dashboard is
// window-scoped (this month / quarter), so a job that completed earlier would
// be counted by the owner-home banner yet missing from the dashboard list.
// This queue uses the exact same filter as countProfitReviewPending, so the
// banner count always equals this list's length. RLS scopes to company.

export interface ReviewQueueCustomer {
  customer_type: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  primary_email: string | null;
}

export interface ReviewQueueRow {
  id: string;
  job_number: string;
  stage: string;
  completed_at: string | null;
  assigned_to_name: string | null;
  customer: ReviewQueueCustomer | null;
}

const REVIEW_QUEUE_COLUMNS = `
  id, job_number, stage, completed_at,
  customer:customers (customer_type, first_name, last_name, company_name, primary_email),
  assigned_to:users!jobs_assigned_to_id_fkey (full_name)
`;

function embedOne<T>(raw: unknown): T | null {
  if (Array.isArray(raw)) return (raw[0] as T | undefined) ?? null;
  return (raw as T | null) ?? null;
}

// Pure flatten — exported so the PostgREST embed-shape normalisation is
// unit-testable without a live Supabase connection.
export function flattenReviewQueueRow(raw: Record<string, unknown>): ReviewQueueRow {
  const assigned = embedOne<{ full_name: string }>(raw.assigned_to);
  return {
    id: raw.id as string,
    job_number: raw.job_number as string,
    stage: raw.stage as string,
    completed_at: (raw.completed_at as string | null) ?? null,
    assigned_to_name: assigned?.full_name ?? null,
    customer: embedOne<ReviewQueueCustomer>(raw.customer),
  };
}

export async function listJobsAwaitingProfitReview(): Promise<ReviewQueueRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('jobs')
    .select(REVIEW_QUEUE_COLUMNS)
    .is('deleted_at', null)
    .eq('profit_review_status', 'pending')
    .in('stage', ['completed', 'invoiced', 'paid'])
    .order('completed_at', { ascending: true })
    .limit(200);
  return ((data ?? []) as Array<Record<string, unknown>>).map(flattenReviewQueueRow);
}
