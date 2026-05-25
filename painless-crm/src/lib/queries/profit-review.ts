import type { ProfitReviewStatus } from '@/lib/jobs/profit';
import { createClient } from '@/lib/supabase/server';

// Loads everything the profit-review form needs in one shot:
// the job's cost columns, its current status + completer, and the
// recognised revenue (sum of `amount_paid_pence` across non-deleted
// invoices linked to this job).
//
// Phase 06b §2. RLS scopes both reads to the caller's company.

export interface ProfitReviewSnapshot {
  job: {
    id: string;
    job_number: string;
    stage: string;
    version: number;
    actual_crew_cost_pence: number | null;
    actual_van_cost_pence: number | null;
    passthrough_costs_pence: number | null;
    profit_review_status: ProfitReviewStatus;
    profit_review_completed_at: string | null;
    profit_review_completed_by: { id: string; full_name: string } | null;
  };
  revenuePence: number;
  invoiceCount: number;
}

const JOB_COLUMNS = `
  id, job_number, stage, version,
  actual_crew_cost_pence, actual_van_cost_pence, passthrough_costs_pence,
  profit_review_status, profit_review_completed_at,
  profit_review_completed_by:users!jobs_profit_review_completed_by_id_fkey (id, full_name)
`;

export async function getProfitReviewSnapshot(jobId: string): Promise<ProfitReviewSnapshot | null> {
  const supabase = await createClient();
  const { data: job } = await supabase
    .from('jobs')
    .select(JOB_COLUMNS)
    .eq('id', jobId)
    .is('deleted_at', null)
    .maybeSingle();
  if (!job) return null;

  const { data: invoices } = await supabase
    .from('invoices')
    .select('amount_paid_pence')
    .eq('job_id', jobId)
    .is('deleted_at', null);

  const revenuePence = (invoices ?? []).reduce<number>(
    (acc, row) => acc + ((row.amount_paid_pence as number | null) ?? 0),
    0,
  );

  return {
    job: job as unknown as ProfitReviewSnapshot['job'],
    revenuePence,
    invoiceCount: (invoices ?? []).length,
  };
}
