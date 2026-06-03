'use server';

import { requireRole } from '@/lib/auth/require-role';
import { STAGE_CHANGED_EVENT } from '@/lib/comms/automation';
import { AutomationRuleSchema } from '@/lib/schemas/automation-rule';
import type { AutomationRuleInput } from '@/lib/schemas/automation-rule';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

const RULE_ROLES = ['manager', 'admin', 'super_admin'] as const;
const LIST = '/dashboard/settings/automations';

export type AutomationRuleActionState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'ok' };

export const INITIAL_AUTOMATION_RULE_STATE: AutomationRuleActionState = { status: 'idle' };

// Only the filter keys relevant to the chosen event are stored — the matcher
// treats any present, non-null key as a constraint (ADR-024), so omitting
// irrelevant keys keeps rules from over-matching.
function buildTriggerFilters(data: AutomationRuleInput): Record<string, string> | null {
  if (data.trigger_event === STAGE_CHANGED_EVENT) {
    const f: Record<string, string> = {};
    if (data.from_stage) f.from = data.from_stage;
    if (data.to_stage) f.to = data.to_stage;
    if (data.service_type) f.service_type = data.service_type;
    return Object.keys(f).length ? f : null;
  }
  if (data.trigger_event === 'invoice.created' || data.trigger_event === 'payment.recorded') {
    return data.kind ? { kind: data.kind } : null;
  }
  return null; // job.created — no filters
}

function buildActionConfig(data: AutomationRuleInput): Record<string, string> {
  const config: Record<string, string> = { template_id: data.template_id };
  // The dwell-guard only makes sense for a delayed stage-change follow-up.
  if (data.trigger_event === STAGE_CHANGED_EVENT && data.requires_stage) {
    config.requires_stage = data.requires_stage;
  }
  return config;
}

export async function saveAutomationRule(
  _prev: AutomationRuleActionState,
  form: FormData,
): Promise<AutomationRuleActionState> {
  const me = await requireRole(RULE_ROLES);

  const parsed = AutomationRuleSchema.safeParse({
    id: form.get('id') || undefined,
    name: form.get('name'),
    trigger_event: form.get('trigger_event') || undefined,
    from_stage: form.get('from_stage') || undefined,
    to_stage: form.get('to_stage') || undefined,
    service_type: form.get('service_type') || undefined,
    kind: form.get('kind') || undefined,
    requires_stage: form.get('requires_stage') || undefined,
    delay_minutes: form.get('delay_minutes') || undefined,
    template_id: form.get('template_id'),
    active: Boolean(form.get('active')),
  });
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const supabase = await createClient();
  const fields = {
    name: parsed.data.name,
    trigger_event: parsed.data.trigger_event,
    trigger_filters: buildTriggerFilters(parsed.data),
    delay_seconds: parsed.data.delay_minutes * 60,
    action_type: 'send_email' as const,
    action_config: buildActionConfig(parsed.data),
    active: parsed.data.active,
  };

  if (parsed.data.id) {
    const { error } = await supabase
      .from('automation_rules')
      .update(fields)
      .eq('id', parsed.data.id);
    if (error) return { status: 'error', message: 'Could not save the rule' };
  } else {
    const { error } = await supabase
      .from('automation_rules')
      .insert({ ...fields, company_id: me.company_id, created_by_id: me.id });
    if (error) return { status: 'error', message: 'Could not create the rule' };
  }

  revalidatePath(LIST);
  redirect(LIST);
}
