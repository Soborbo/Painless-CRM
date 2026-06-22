import { REVIEW_CONFIG } from '@/lib/reviews/engine/config';
import { initialNextSend } from '@/lib/reviews/engine/time';
import type { createClient } from '@/lib/supabase/server';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// Phase 11 §3 — when a job enters `paid`, queue its universal review request.
// One request per sign-off (DB unique index), inserted `pending` with the brain's
// first next_send_at (+24h after paid); the sweep takes it from there (sweep.ts).
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
  // trigger_at = the paid moment (≈ now); the brain schedules the first send at
  // scheduleDays[0] (+24h) and the sweep advances from there (ADR-047).
  const now = new Date().toISOString();
  const nextSendAt = initialNextSend(
    now,
    REVIEW_CONFIG.scheduleDays,
    REVIEW_CONFIG.timezone,
    REVIEW_CONFIG.sendHours,
    REVIEW_CONFIG.sendDays,
  );
  const { error } = await supabase.from('review_requests').insert({
    company_id: companyId,
    signoff_id: row.id,
    customer_id: row.customer_id,
    channel: 'email',
    status: 'pending',
    sent_at: null,
    followup_count: 0,
    attempts_sent: 0,
    trigger_at: now,
    next_send_at: nextSendAt,
  });
  if (error) {
    // 23505 = the one-per-signoff guard already has a row → idempotent no-op.
    if (error.code === '23505') return 'exists';
    return 'no_signoff';
  }
  return 'queued';
}
