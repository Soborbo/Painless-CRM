// Phase 13 §5 + Phase 13b (ADR-024) — automation rule matching. Pure so the
// enqueue hooks and their tests share one matcher. A rule fires when its
// trigger_event equals the fired event, it's active, and every filter it
// declares matches the event context. A null filter value is a wildcard; a
// context key the filter doesn't mention is ignored.

export interface AutomationRule {
  id: string;
  trigger_event: string;
  trigger_filters: AutomationFilters | null;
  delay_seconds: number | null;
  active: boolean;
}

// Filters are stored as jsonb, so the shape is open. The keys the engine
// understands today: stage from/to (job.stage_changed) and service_type
// (ADR-025, the quote service line). Unknown keys simply never match.
export type AutomationFilters = {
  from?: string | null;
  to?: string | null;
  service_type?: string | null;
} & Record<string, string | null | undefined>;

// The context a fired event carries, checked against each rule's filters.
export type EventContext = Record<string, string | null | undefined>;

export const STAGE_CHANGED_EVENT = 'job.stage_changed';

// The trigger events the admin UI can configure a rule against (ADR-024).
export const TRIGGER_EVENTS = [
  'job.created',
  'job.stage_changed',
  'invoice.created',
  'payment.recorded',
] as const;
export type TriggerEvent = (typeof TRIGGER_EVENTS)[number];

// Human labels for the form, list and flowchart.
export const TRIGGER_EVENT_LABELS: Record<TriggerEvent, string> = {
  'job.created': 'New enquiry (job created)',
  'job.stage_changed': 'Job changes stage',
  'invoice.created': 'Invoice created',
  'payment.recorded': 'Payment recorded',
};

// Invoice/payment "kind" filter values (mirrors invoice types — see schemas/invoice).
export const INVOICE_KINDS = ['deposit', 'custom', 'final', 'credit_note'] as const;

/** Generalised matcher: rules whose event matches and whose every declared,
 *  non-null filter equals the same key in the context. */
export function matchRules(
  rules: AutomationRule[],
  event: string,
  context: EventContext,
): AutomationRule[] {
  return rules.filter((rule) => {
    if (!rule.active || rule.trigger_event !== event) return false;
    const filters = rule.trigger_filters ?? {};
    for (const [key, expected] of Object.entries(filters)) {
      if (expected == null) continue; // wildcard
      if (context[key] !== expected) return false;
    }
    return true;
  });
}

/** Stage-change matcher — the original Phase 13 entry point, now a thin wrapper
 *  over matchRules so existing callers (and tests) are unchanged. */
export function matchStageRules(
  rules: AutomationRule[],
  fromStage: string,
  toStage: string,
  serviceType?: string,
): AutomationRule[] {
  return matchRules(rules, STAGE_CHANGED_EVENT, {
    from: fromStage,
    to: toStage,
    service_type: serviceType,
  });
}

// When a matched rule's action should run, given its delay.
export function scheduledFor(now: Date, delaySeconds: number | null): string {
  const ms = (delaySeconds ?? 0) * 1000;
  return new Date(now.getTime() + ms).toISOString();
}
