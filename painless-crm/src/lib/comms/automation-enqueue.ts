import { createAdminClient } from '@/lib/supabase/admin';
import {
  type AutomationRule,
  type EventContext,
  STAGE_CHANGED_EVENT,
  matchRules,
  scheduledFor,
} from './automation';

// Phase 13 §5 + Phase 13b (ADR-024) — enqueue automation actions when an event
// fires. Called best-effort from every producer (stage transitions, job create,
// invoice create, payment recorded). Uses the service-role client because
// automation_queue is locked to service_role (SECURITY_MODEL); a failure here
// must never break the originating mutation.
//
// `context` is matched against each rule's trigger_filters and also merged into
// the queued payload, so the cron's variable builder and dwell-guard see it.
export async function enqueueEventAutomation(
  args: {
    companyId: string;
    event: string;
    jobId?: string | null;
    context?: EventContext;
    payloadExtra?: Record<string, string | null | undefined>;
  },
  now: Date = new Date(),
): Promise<void> {
  const supabase = createAdminClient();
  const context = args.context ?? {};

  const { data: ruleRows } = await supabase
    .from('automation_rules')
    .select('id, trigger_event, trigger_filters, delay_seconds, active')
    .eq('company_id', args.companyId)
    .eq('active', true)
    .eq('trigger_event', args.event);

  const matched = matchRules((ruleRows ?? []) as AutomationRule[], args.event, context);
  if (matched.length === 0) return;

  const payload = { job_id: args.jobId ?? null, ...context, ...args.payloadExtra };
  await supabase.from('automation_queue').insert(
    matched.map((rule) => ({
      company_id: args.companyId,
      rule_id: rule.id,
      trigger_event: args.event,
      payload,
      scheduled_for: scheduledFor(now, rule.delay_seconds),
    })),
  );
}

// Stage-change producer — the original Phase 13 entry point, now a thin wrapper
// over enqueueEventAutomation. Carries service_type so quote rules (ADR-025) can
// filter on the job's service line.
export async function enqueueStageAutomation(
  args: {
    companyId: string;
    jobId: string;
    fromStage: string;
    toStage: string;
    serviceType?: string | null;
  },
  now: Date = new Date(),
): Promise<void> {
  await enqueueEventAutomation(
    {
      companyId: args.companyId,
      event: STAGE_CHANGED_EVENT,
      jobId: args.jobId,
      context: {
        from: args.fromStage,
        to: args.toStage,
        service_type: args.serviceType ?? undefined,
      },
    },
    now,
  );
}
