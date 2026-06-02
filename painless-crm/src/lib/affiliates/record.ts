import { computeCommissionPence } from '@/lib/affiliates/commission';
import type { CommissionType } from '@/lib/schemas/affiliate';
import type { createClient } from '@/lib/supabase/server';

type DbClient = Awaited<ReturnType<typeof createClient>>;

// Phase 16 §1 — when a job enters `paid`, create the affiliate commission row
// (status 'pending'). Idempotent: at most one commission_record per job, so a
// re-entry into `paid` (or a replay) never double-pays. Best-effort — a
// commission failure must never block the stage transition.
export async function recordCommissionForPaidJob(
  supabase: DbClient,
  companyId: string,
  jobId: string,
): Promise<void> {
  const { data: jobRow } = await supabase
    .from('jobs')
    .select('affiliate_id, quote_total_pence')
    .eq('id', jobId)
    .maybeSingle();
  const job = jobRow as { affiliate_id: string | null; quote_total_pence: number | null } | null;
  if (!job?.affiliate_id) return;

  // Idempotency guard — already have a commission for this job?
  const { data: existing } = await supabase
    .from('commission_records')
    .select('id')
    .eq('job_id', jobId)
    .maybeSingle();
  if (existing) return;

  const { data: affRow } = await supabase
    .from('affiliates')
    .select('commission_type, commission_value, commission_config')
    .eq('id', job.affiliate_id)
    .is('deleted_at', null)
    .maybeSingle();
  const affiliate = affRow as {
    commission_type: string | null;
    commission_value: number | null;
    commission_config: unknown;
  } | null;
  if (!affiliate?.commission_type) return;

  // Won-job count (incl. this one) drives the tier bracket.
  const { count } = await supabase
    .from('jobs')
    .select('id', { count: 'exact', head: true })
    .eq('affiliate_id', job.affiliate_id)
    .not('paid_at', 'is', null)
    .is('deleted_at', null);

  const amountPence = computeCommissionPence(
    {
      commissionType: affiliate.commission_type as CommissionType,
      commissionValue: affiliate.commission_value,
      commissionConfig: affiliate.commission_config,
    },
    { jobRevenuePence: job.quote_total_pence ?? 0, wonJobCount: count ?? 1 },
  );
  if (amountPence <= 0) return;

  await supabase.from('commission_records').insert({
    company_id: companyId,
    affiliate_id: job.affiliate_id,
    job_id: jobId,
    amount_pence: amountPence,
    status: 'pending',
  });
}
