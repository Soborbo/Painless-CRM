import { createClient } from '@/lib/supabase/server';

// Phase 13 §5 — automation rule reads. RLS scopes to the company.

export interface AutomationRuleRow {
  id: string;
  name: string;
  from_stage: string | null;
  to_stage: string | null;
  delay_seconds: number;
  template_id: string | null;
  active: boolean;
  run_count: number;
}

function toRow(raw: Record<string, unknown>): AutomationRuleRow {
  const filters = (raw.trigger_filters ?? {}) as { from?: string | null; to?: string | null };
  const config = (raw.action_config ?? {}) as { template_id?: string | null };
  return {
    id: raw.id as string,
    name: raw.name as string,
    from_stage: filters.from ?? null,
    to_stage: filters.to ?? null,
    delay_seconds: (raw.delay_seconds as number) ?? 0,
    template_id: config.template_id ?? null,
    active: Boolean(raw.active),
    run_count: (raw.run_count as number) ?? 0,
  };
}

const SELECT = 'id, name, trigger_filters, delay_seconds, action_config, active, run_count';

export async function listAutomationRules(): Promise<AutomationRuleRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('automation_rules')
    .select(SELECT)
    .order('created_at', { ascending: false });
  return ((data ?? []) as Array<Record<string, unknown>>).map(toRow);
}

export async function getAutomationRule(id: string): Promise<AutomationRuleRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('automation_rules')
    .select(SELECT)
    .eq('id', id)
    .maybeSingle();
  return data ? toRow(data as Record<string, unknown>) : null;
}
