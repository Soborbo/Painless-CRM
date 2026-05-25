import type { ProfitReviewStatus } from '@/lib/jobs/profit';
import type { DateRange, ProfitDashboardJob } from '@/lib/jobs/profit-dashboard';
import { createClient } from '@/lib/supabase/server';

// Phase 06b §2b. Lists profit-eligible jobs in a date range together
// with their recognised revenue. We fetch jobs first, then sum the
// paid-invoice amounts per job in a single follow-up query — RLS
// keeps both reads tenant-scoped.

const JOB_COLUMNS = `
  id, job_number, stage, completed_at, acquisition_source,
  actual_crew_cost_pence, actual_van_cost_pence, passthrough_costs_pence,
  profit_review_status,
  customer:customers (customer_type, first_name, last_name, company_name, primary_email),
  assigned_to:users!jobs_assigned_to_id_fkey (id, full_name)
`;

const MAX_JOBS_PER_PAGE = 200;

export async function listProfitDashboardJobs(range: DateRange): Promise<ProfitDashboardJob[]> {
  const supabase = await createClient();
  const { data: jobs } = await supabase
    .from('jobs')
    .select(JOB_COLUMNS)
    .is('deleted_at', null)
    .in('stage', ['completed', 'invoiced', 'paid'])
    .gte('completed_at', range.startIso)
    .lt('completed_at', range.endIso)
    .order('completed_at', { ascending: false })
    .limit(MAX_JOBS_PER_PAGE);

  const rows = (jobs ?? []) as unknown as Array<
    Omit<ProfitDashboardJob, 'revenuePence' | 'profit_review_status'> & {
      profit_review_status: ProfitReviewStatus;
    }
  >;
  if (rows.length === 0) return [];

  const jobIds = rows.map((j) => j.id);
  const { data: invoices } = await supabase
    .from('invoices')
    .select('job_id, amount_paid_pence')
    .is('deleted_at', null)
    .in('job_id', jobIds);

  const revenueByJob = new Map<string, number>();
  for (const inv of invoices ?? []) {
    const jobId = inv.job_id as string | null;
    if (!jobId) continue;
    const paid = (inv.amount_paid_pence as number | null) ?? 0;
    revenueByJob.set(jobId, (revenueByJob.get(jobId) ?? 0) + paid);
  }

  return rows.map((row) => ({ ...row, revenuePence: revenueByJob.get(row.id) ?? 0 }));
}
