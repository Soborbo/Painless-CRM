import { createAdminClient } from '@/lib/supabase/admin';
import {
  type AutomationRule,
  STAGE_CHANGED_EVENT,
  matchStageRules,
  scheduledFor,
} from './automation';

// Phase 13 §5 — enqueue automation actions when a job's stage changes. Called
// (best-effort) from every transition path: the manual transition action, quote
// acceptance (→accepted) and the sign-off completion (→completed). Uses the
// service-role client because automation_queue is locked to service_role
// (SECURITY_MODEL); a failure here must never break the transition itself.
export async function enqueueStageAutomation(
  args: { companyId: string; jobId: string; fromStage: string; toStage: string },
  now: Date = new Date(),
): Promise<void> {
  const supabase = createAdminClient();

  const { data: ruleRows } = await supabase
    .from('automation_rules')
    .select('id, trigger_event, trigger_filters, delay_seconds, active')
    .eq('company_id', args.companyId)
    .eq('active', true)
    .eq('trigger_event', STAGE_CHANGED_EVENT);

  const matched = matchStageRules(
    (ruleRows ?? []) as AutomationRule[],
    args.fromStage,
    args.toStage,
  );
  if (matched.length === 0) return;

  const payload = { job_id: args.jobId, from: args.fromStage, to: args.toStage };
  await supabase.from('automation_queue').insert(
    matched.map((rule) => ({
      company_id: args.companyId,
      rule_id: rule.id,
      trigger_event: STAGE_CHANGED_EVENT,
      payload,
      scheduled_for: scheduledFor(now, rule.delay_seconds),
    })),
  );
}
