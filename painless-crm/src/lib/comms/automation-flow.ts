import type { AutomationRuleRow } from '@/lib/queries/automation-rules';

// Phase 13b — groups automation rules for the admin flowchart. Pure so it's
// unit-tested and the flowchart page stays a thin renderer. Stage-change rules
// are bucketed by their target stage; event rules (job.created, invoice.created,
// payment.recorded) are listed in their own lane.

export interface FlowEmail {
  ruleId: string;
  ruleName: string;
  templateId: string | null;
  templateName: string;
  delayLabel: string | null;
  dwell: boolean;
  serviceType: string | null;
  kind: string | null;
  active: boolean;
}

export interface FlowModel {
  /** stage-change emails keyed by target stage ('any' when no `to` filter) */
  byStage: Record<string, FlowEmail[]>;
  /** event-triggered emails, keyed by trigger_event */
  byEvent: Record<string, FlowEmail[]>;
}

/** Human delay label, e.g. 0 → null, 7200 → "+2h", 172800 → "+2d". */
export function formatDelay(seconds: number): string | null {
  if (!seconds || seconds <= 0) return null;
  const mins = Math.round(seconds / 60);
  if (mins % 1440 === 0) return `+${mins / 1440}d`;
  if (mins % 60 === 0) return `+${mins / 60}h`;
  return `+${mins}m`;
}

function toEmail(rule: AutomationRuleRow, nameOf: (id: string | null) => string): FlowEmail {
  return {
    ruleId: rule.id,
    ruleName: rule.name,
    templateId: rule.template_id,
    templateName: nameOf(rule.template_id),
    delayLabel: formatDelay(rule.delay_seconds),
    dwell: Boolean(rule.requires_stage),
    serviceType: rule.service_type,
    kind: rule.kind,
    active: rule.active,
  };
}

export function buildFlowModel(
  rules: AutomationRuleRow[],
  templateNames: Map<string, string>,
): FlowModel {
  const nameOf = (id: string | null) => (id ? (templateNames.get(id) ?? 'Unknown template') : '—');
  const byStage: Record<string, FlowEmail[]> = {};
  const byEvent: Record<string, FlowEmail[]> = {};

  for (const rule of rules) {
    const email = toEmail(rule, nameOf);
    if (rule.trigger_event === 'job.stage_changed') {
      const key = rule.to_stage ?? 'any';
      const list = byStage[key] ?? [];
      list.push(email);
      byStage[key] = list;
    } else {
      const list = byEvent[rule.trigger_event] ?? [];
      list.push(email);
      byEvent[rule.trigger_event] = list;
    }
  }

  // Within a stage, order by delay so the immediate email leads the follow-ups.
  for (const list of Object.values(byStage)) {
    list.sort((a, b) => delayWeight(a) - delayWeight(b));
  }
  return { byStage, byEvent };
}

function delayWeight(email: FlowEmail): number {
  if (!email.delayLabel) return 0;
  const n = Number(email.delayLabel.replace(/[^0-9]/g, ''));
  const unit = email.delayLabel.slice(-1);
  return unit === 'd' ? n * 1440 : unit === 'h' ? n * 60 : n;
}
