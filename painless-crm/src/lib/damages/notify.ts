import { createNotifications } from '@/lib/notifications/create';
import { createAdminClient } from '@/lib/supabase/admin';

// Phase 16 §4 — in-app notification to managers/admins when a damage claim
// auto-escalates (payout over threshold). Best-effort; the body carries only a
// link, never PII. Recipients are resolved on the service-role client because
// the triggering user can't read other users' rows under RLS.

const RECIPIENT_ROLES = ['manager', 'admin', 'super_admin'];

async function managerIds(companyId: string): Promise<string[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('users')
    .select('id')
    .eq('company_id', companyId)
    .in('role', RECIPIENT_ROLES)
    .eq('active', true);
  return ((data ?? []) as Array<{ id: string }>).map((r) => r.id);
}

export async function notifyDamageEscalation(args: {
  companyId: string;
  jobId: string;
  jobNumber: string | number | null;
  payoutPence: number;
}): Promise<void> {
  const ids = await managerIds(args.companyId);
  const label = args.jobNumber != null ? `job #${args.jobNumber}` : 'a job';
  await createNotifications(ids, {
    companyId: args.companyId,
    type: 'damage',
    title: 'Large damage payout escalated',
    body: `A damage payout on ${label} exceeded the escalation threshold and needs admin review.`,
    linkUrl: `/dashboard/jobs/${args.jobId}/damages`,
    relatedEntityType: 'job',
    relatedEntityId: args.jobId,
    priority: 'high',
  });
}
