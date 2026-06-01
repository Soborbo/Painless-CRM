'use server';

import { requireRole } from '@/lib/auth/require-role';
import { STAGE_CHANGED_EVENT } from '@/lib/comms/automation';
import { AutomationRuleSchema } from '@/lib/schemas/automation-rule';
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

export async function saveAutomationRule(
  _prev: AutomationRuleActionState,
  form: FormData,
): Promise<AutomationRuleActionState> {
  const me = await requireRole(RULE_ROLES);

  const parsed = AutomationRuleSchema.safeParse({
    id: form.get('id') || undefined,
    name: form.get('name'),
    from_stage: form.get('from_stage') || undefined,
    to_stage: form.get('to_stage') || undefined,
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
    trigger_event: STAGE_CHANGED_EVENT,
    trigger_filters: { from: parsed.data.from_stage ?? null, to: parsed.data.to_stage ?? null },
    delay_seconds: parsed.data.delay_minutes * 60,
    action_type: 'send_email' as const,
    action_config: { template_id: parsed.data.template_id },
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
