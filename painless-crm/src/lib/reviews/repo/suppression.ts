import type { Status } from '@/lib/reviews/engine/types';
import type { createAdminClient } from '@/lib/supabase/admin';

// Email suppression repo (ADR-047). Service-role client (RLS bypassed); always
// scoped explicitly by company_id since there's no auth context in the sweep /
// webhook. A suppressed email is never sent to again (deliverability + GDPR).

type Admin = ReturnType<typeof createAdminClient>;

export type SuppressionReason = 'hard_bounce' | 'spam_complaint' | 'unsubscribe' | 'manual';

export async function isSuppressed(
  supabase: Admin,
  companyId: string,
  email: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('review_suppression')
    .select('id')
    .eq('company_id', companyId)
    .eq('email', email)
    .limit(1)
    .maybeSingle();
  return data !== null;
}

export async function addSuppression(
  supabase: Admin,
  companyId: string,
  email: string,
  reason: SuppressionReason,
): Promise<void> {
  // Idempotent: UNIQUE (company_id, email) — a repeat is a no-op, not an error.
  const { error } = await supabase
    .from('review_suppression')
    .insert({ company_id: companyId, email, reason });
  if (error && error.code !== '23505') throw error;
}

/** Close any still-open requests for an email (e.g. after a bounce/unsub). */
export async function closeActiveForEmail(
  supabase: Admin,
  companyId: string,
  email: string,
  status: Extract<Status, 'unsubscribed' | 'complained'>,
): Promise<void> {
  // review_requests carries customer_id, not email, so resolve via the customer.
  const { data: customers } = await supabase
    .from('customers')
    .select('id')
    .eq('company_id', companyId)
    .eq('primary_email', email);
  const ids = ((customers ?? []) as Array<{ id: string }>).map((c) => c.id);
  if (ids.length === 0) return;
  await supabase
    .from('review_requests')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('company_id', companyId)
    .in('customer_id', ids)
    .in('status', ['pending', 'active']);
}
