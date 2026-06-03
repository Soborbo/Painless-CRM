import {
  type AutomationRule,
  matchRules,
  matchStageRules,
  scheduledFor,
} from '@/lib/comms/automation';
import { describe, expect, it } from 'vitest';

const rule = (over: Partial<AutomationRule>): AutomationRule => ({
  id: 'r',
  trigger_event: 'job.stage_changed',
  trigger_filters: null,
  delay_seconds: 0,
  active: true,
  ...over,
});

describe('matchStageRules', () => {
  it('matches on from+to filters', () => {
    const rules = [
      rule({ id: 'a', trigger_filters: { from: 'quoted', to: 'declined' } }),
      rule({ id: 'b', trigger_filters: { from: 'quoted', to: 'accepted' } }),
    ];
    expect(matchStageRules(rules, 'quoted', 'declined').map((r) => r.id)).toEqual(['a']);
  });

  it('treats null filters as wildcards', () => {
    const rules = [
      rule({ id: 'anyTo', trigger_filters: { from: 'quoted', to: null } }),
      rule({ id: 'anyFrom', trigger_filters: { from: null, to: 'paid' } }),
      rule({ id: 'all', trigger_filters: null }),
    ];
    expect(
      matchStageRules(rules, 'quoted', 'paid')
        .map((r) => r.id)
        .sort(),
    ).toEqual(['all', 'anyFrom', 'anyTo']);
  });

  it('ignores inactive rules and other events', () => {
    const rules = [
      rule({ id: 'off', active: false }),
      rule({ id: 'other', trigger_event: 'invoice.overdue' }),
    ];
    expect(matchStageRules(rules, 'quoted', 'declined')).toHaveLength(0);
  });
});

describe('matchRules — generalised matcher (ADR-024)', () => {
  it('filters by service_type on the quoted stage', () => {
    const rules = [
      rule({
        id: 'removal',
        trigger_filters: { to: 'quoted', service_type: 'removal' },
      }),
      rule({
        id: 'waste',
        trigger_filters: { to: 'quoted', service_type: 'waste_clearance' },
      }),
    ];
    const ctx = { from: 'contacted', to: 'quoted', service_type: 'waste_clearance' };
    expect(matchRules(rules, 'job.stage_changed', ctx).map((r) => r.id)).toEqual(['waste']);
  });

  it('a service_type rule does not match when the context lacks it', () => {
    const rules = [rule({ id: 'r', trigger_filters: { to: 'quoted', service_type: 'removal' } })];
    expect(matchRules(rules, 'job.stage_changed', { to: 'quoted' })).toHaveLength(0);
  });

  it('matches non-stage events by their own filter keys', () => {
    const rules = [
      rule({ id: 'dep', trigger_event: 'payment.recorded', trigger_filters: { kind: 'deposit' } }),
      rule({ id: 'fin', trigger_event: 'payment.recorded', trigger_filters: { kind: 'final' } }),
    ];
    expect(
      matchRules(rules, 'payment.recorded', { kind: 'final' }).map((r) => r.id),
    ).toEqual(['fin']);
  });

  it('a null/absent filter is a wildcard', () => {
    const rules = [rule({ id: 'any', trigger_event: 'job.created', trigger_filters: null })];
    expect(matchRules(rules, 'job.created', {}).map((r) => r.id)).toEqual(['any']);
  });
});

describe('scheduledFor', () => {
  it('adds the delay to now', () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    expect(scheduledFor(now, 0)).toBe('2026-01-01T00:00:00.000Z');
    expect(scheduledFor(now, 3600)).toBe('2026-01-01T01:00:00.000Z');
    expect(scheduledFor(now, null)).toBe('2026-01-01T00:00:00.000Z');
  });
});
