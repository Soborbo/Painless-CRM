import { createClient } from '@/lib/supabase/server';

// Phase 13 §5 + Phase 13b (ADR-024) — automation rule reads. RLS scopes to the
// company. The row flattens the jsonb trigger_filters / action_config into the
// fields the form, list and flowchart use.

export interface AutomationRuleRow {
  id: string;
  name: string;
  trigger_event: string;
  from_stage: string | null;
  to_stage: string | null;
  service_type: string | null;
  kind: string | null;
  requires_stage: string | null;
  delay_seconds: number;
  template_id: string | null;
  active: boolean;
  run_count: number;
}

function toRow(raw: Record<string, unknown>): AutomationRuleRow {
  const filters = (raw.trigger_filters ?? {}) as {
    from?: string | null;
    to?: string | null;
    service_type?: string | null;
    kind?: string | null;
  };
  const config = (raw.action_config ?? {}) as {
    template_id?: string | null;
    requires_stage?: string | null;
  };
  return {
    id: raw.id as string,
    name: raw.name as string,
    trigger_event: (raw.trigger_event as string) ?? 'job.stage_changed',
    from_stage: filters.from ?? null,
    to_stage: filters.to ?? null,
    service_type: filters.service_type ?? null,
    kind: filters.kind ?? null,
    requires_stage: config.requires_stage ?? null,
    delay_seconds: (raw.delay_seconds as number) ?? 0,
    template_id: config.template_id ?? null,
    active: Boolean(raw.active),
    run_count: (raw.run_count as number) ?? 0,
  };
}

const SELECT =
  'id, name, trigger_event, trigger_filters, delay_seconds, action_config, active, run_count';

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
