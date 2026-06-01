import { serverEnv } from '@/lib/env';
import { sendComplaintEmail } from '@/lib/integrations/resend/complaint';
import { createAdminClient } from '@/lib/supabase/admin';

// Phase 11 §5 — complaint notifications. Recipients are the company's managers
// and admins (the spec's "operations admin / complaints owner"). Body carries
// only an in-app link, never the customer's free text (PII stays behind RLS).

const RECIPIENT_ROLES = ['manager', 'admin'];

async function recipients(companyId: string): Promise<string[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('users')
    .select('email')
    .eq('company_id', companyId)
    .in('role', RECIPIENT_ROLES)
    .eq('active', true);
  return ((data ?? []) as Array<{ email: string }>).map((r) => r.email).filter(Boolean);
}

function ticketUrl(): string {
  return `${serverEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, '')}/dashboard/complaints`;
}

export async function notifyNewComplaint(companyId: string): Promise<void> {
  await sendComplaintEmail({
    to: await recipients(companyId),
    subject: 'New customer complaint — 24h first-response SLA',
    text: `A new complaint was submitted. Review and respond within 24 hours:\n${ticketUrl()}`,
  });
}

export async function notifyEscalation(companyId: string, count: number): Promise<void> {
  await sendComplaintEmail({
    to: await recipients(companyId),
    subject: `${count} complaint(s) escalated — unresolved after 7 days`,
    text: `${count} complaint(s) have been open for over 7 days and were escalated:\n${ticketUrl()}`,
  });
}
