import { buildFlowModel, formatDelay } from '@/lib/comms/automation-flow';
import type { AutomationRuleRow } from '@/lib/queries/automation-rules';
import { describe, expect, it } from 'vitest';

const row = (over: Partial<AutomationRuleRow>): AutomationRuleRow => ({
  id: 'r',
  name: 'Rule',
  trigger_event: 'job.stage_changed',
  from_stage: null,
  to_stage: null,
  service_type: null,
  kind: null,
  requires_stage: null,
  delay_seconds: 0,
  template_id: 't1',
  active: true,
  run_count: 0,
  ...over,
});

const NAMES = new Map([
  ['t1', 'Quotation'],
  ['t2', 'Follow up'],
  ['t3', 'Deposit invoice'],
]);

describe('formatDelay', () => {
  it('formats common cadences', () => {
    expect(formatDelay(0)).toBeNull();
    expect(formatDelay(172800)).toBe('+2d');
    expect(formatDelay(7200)).toBe('+2h');
    expect(formatDelay(300)).toBe('+5m');
  });
});

describe('buildFlowModel', () => {
  it('buckets stage rules by target stage and resolves template names', () => {
    const model = buildFlowModel([row({ id: 'a', to_stage: 'quoted', template_id: 't1' })], NAMES);
    const quoted = model.byStage.quoted ?? [];
    expect(quoted).toHaveLength(1);
    expect(quoted[0]?.templateName).toBe('Quotation');
  });

  it('orders a stage immediate-first, then follow-ups by delay', () => {
    const model = buildFlowModel(
      [
        row({ id: 'f2', to_stage: 'quoted', template_id: 't2', delay_seconds: 432000 }),
        row({ id: 'now', to_stage: 'quoted', template_id: 't1', delay_seconds: 0 }),
        row({ id: 'f1', to_stage: 'quoted', template_id: 't2', delay_seconds: 172800 }),
      ],
      NAMES,
    );
    expect((model.byStage.quoted ?? []).map((e) => e.ruleId)).toEqual(['now', 'f1', 'f2']);
  });

  it('flags the dwell-guard and routes event rules to byEvent', () => {
    const model = buildFlowModel(
      [
        row({ id: 'fu', to_stage: 'quoted', requires_stage: 'quoted', delay_seconds: 172800 }),
        row({ id: 'inv', trigger_event: 'invoice.created', kind: 'deposit', template_id: 't3' }),
      ],
      NAMES,
    );
    expect((model.byStage.quoted ?? [])[0]?.dwell).toBe(true);
    const invoiceRules = model.byEvent['invoice.created'] ?? [];
    expect(invoiceRules).toHaveLength(1);
    expect(invoiceRules[0]?.kind).toBe('deposit');
  });

  it('uses "any" when a stage rule has no target', () => {
    const model = buildFlowModel([row({ id: 'x', to_stage: null })], NAMES);
    expect(model.byStage.any ?? []).toHaveLength(1);
  });
});
