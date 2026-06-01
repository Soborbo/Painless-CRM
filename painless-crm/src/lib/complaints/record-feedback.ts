import type { PublicFeedbackInput } from '@/lib/schemas/complaint';
import { createAdminClient } from '@/lib/supabase/admin';
import { firstResponseDueAt, severityFromSelfAssessed } from './state-machine';

// Phase 11 §5 — public complaints form submission. No auth: the token is the
// review_request id, and the service-role client resolves the job/customer it
// belongs to. Creates a `new` complaint with a 24h first-response SLA and marks
// the review request as responded (which stops review follow-ups).

export type FeedbackResult =
  | { ok: true; complaintId: string; companyId: string }
  | { ok: false; reason: 'not_found' | 'error' };

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
  if (error || !inserted) return { ok: false, reason: 'error' };

  // Mark the review request responded → stops review follow-ups (acceptance #5).
  await supabase
    .from('review_requests')
    .update({
      complaints_link_clicked_at: now.toISOString(),
      responded_at: req.responded_at ?? now.toISOString(),
      status: 'clicked',
    })
    .eq('id', req.id);

  return { ok: true, complaintId: (inserted as { id: string }).id, companyId: req.company_id };
}
