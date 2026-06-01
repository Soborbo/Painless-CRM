// Phase 13 §5 — automation rule matching. Pure so the enqueue hook (fired on
// every job stage change) and its tests share one matcher. A rule fires when
// its trigger_event is the stage-change event, it's active, and its optional
// from/to filters match the transition.

export interface AutomationRule {
  id: string;
  trigger_event: string;
  trigger_filters: { from?: string | null; to?: string | null } | null;
  delay_seconds: number | null;
  active: boolean;
}

export const STAGE_CHANGED_EVENT = 'job.stage_changed';

export function matchStageRules(
  rules: AutomationRule[],
  fromStage: string,
  toStage: string,
): AutomationRule[] {
  return rules.filter((rule) => {
    if (!rule.active || rule.trigger_event !== STAGE_CHANGED_EVENT) return false;
    const filters = rule.trigger_filters ?? {};
    if (filters.from != null && filters.from !== fromStage) return false;
    if (filters.to != null && filters.to !== toStage) return false;
    return true;
  });
}

// When a matched rule's action should run, given its delay.
export function scheduledFor(now: Date, delaySeconds: number | null): string {
  const ms = (delaySeconds ?? 0) * 1000;
  return new Date(now.getTime() + ms).toISOString();
}
