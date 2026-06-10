import type { PublicFeedbackInput } from '@/lib/schemas/complaint';
import { createAdminClient } from '@/lib/supabase/admin';
import { firstResponseDueAt, severityFromSelfAssessed } from './state-machine';

// Phase 11 §5 — public complaints form submission. No auth: the token is the
// review_request id, and the service-role client resolves the job/customer it
// belongs to. Creates a `new` complaint with a 24h first-response SLA and marks
// the review request as responded (which stops review follow-ups).

export type FeedbackResult =
  | { ok: true; complaintId: string; companyId: string }
  | { ok: false; reason: 'not_found' | 'already_submitted' | 'error' };

function composeDescription(input: PublicFeedbackInput): string {
  const parts = [input.description];
  if (input.preferred_resolution)
    parts.push(`\nPreferred resolution: ${input.preferred_resolution}`);
  if (input.contact_method) parts.push(`\nBest contact: ${input.contact_method}`);
  return parts.join('\n');
}

export async function persistFeedback(
  token: string,
  input: PublicFeedbackInput,
  now: Date = new Date(),
): Promise<FeedbackResult> {
  const supabase = createAdminClient();

  const { data: reqRow } = await supabase
    .from('review_requests')
    .select('id, company_id, customer_id, responded_at, signoff:customer_signoffs(job_id)')
    .eq('id', token)
    .is('deleted_at', null)
    .maybeSingle();
  if (!reqRow) return { ok: false, reason: 'not_found' };

  const req = reqRow as unknown as {
    id: string;
    company_id: string;
    customer_id: string;
    responded_at: string | null;
    signoff: { job_id: string } | { job_id: string }[];
  };
  const signoff = Array.isArray(req.signoff) ? req.signoff[0] : req.signoff;
  if (!signoff?.job_id) return { ok: false, reason: 'error' };

  // Single-use claim BEFORE inserting: atomically mark the request responded and
  // proceed only if WE were the one to flip it from null. This turns the public
  // endpoint from "insert a complaint on every POST" (a spam vector — audit M8)
  // into one-complaint-per-token. A concurrent/repeat submission gets no row
  // back and is treated as already-submitted.
  const { data: claimed } = await supabase
    .from('review_requests')
    .update({
      complaints_link_clicked_at: now.toISOString(),
      responded_at: now.toISOString(),
      status: 'clicked',
    })
    .eq('id', req.id)
    .is('responded_at', null)
    .select('id')
    .maybeSingle();
  if (!claimed) return { ok: false, reason: 'already_submitted' };

  const { data: inserted, error } = await supabase
    .from('complaints')
    .insert({
      company_id: req.company_id,
      job_id: signoff.job_id,
      customer_id: req.customer_id,
      source: 'other',
      description: composeDescription(input),
      severity: severityFromSelfAssessed(input.severity_self_assessed),
      severity_self_assessed: input.severity_self_assessed,
      status: 'new',
      sla_first_response_due_at: firstResponseDueAt(now).toISOString(),
    })
    .select('id')
    .single();
  if (error || !inserted) {
    // Release the claim so a genuine submission can be retried after a failure.
    await supabase.from('review_requests').update({ responded_at: null }).eq('id', req.id);
    return { ok: false, reason: 'error' };
  }

  return { ok: true, complaintId: (inserted as { id: string }).id, companyId: req.company_id };
}
