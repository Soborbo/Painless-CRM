import type { createClient } from '@/lib/supabase/server';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// Phase 11 §3 — when a job enters `paid`, queue its universal review request.
// One request per sign-off (DB unique index), and we insert it `pending` with
// sent_at = null so the cron sends it 24h after paid (see lib/reviews/followup).
// Idempotent: a duplicate enqueue (e.g. a paid → unpaid → paid bounce) is a
// no-op on the unique index. No branch on satisfaction — every paid job queues.
export async function enqueueReviewRequest(
  supabase: SupabaseServerClient,
  companyId: string,
  jobId: string,
): Promise<'queued' | 'no_signoff' | 'exists'> {
  const { data: signoff } = await supabase
    .from('customer_signoffs')
    .select('id, customer_id')
    .eq('job_id', jobId)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle();
  if (!signoff) return 'no_signoff';

  const row = signoff as { id: string; customer_id: string };
  const { error } = await supabase.from('review_requests').insert({
    company_id: companyId,
    signoff_id: row.id,
    customer_id: row.customer_id,
    channel: 'email',
    status: 'pending',
    sent_at: null,
    followup_count: 0,
  });
  if (error) {
    // 23505 = the one-per-signoff guard already has a row → idempotent no-op.
    if (error.code === '23505') return 'exists';
    return 'no_signoff';
  }
  return 'queued';
}
