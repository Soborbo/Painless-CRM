import { type AutomationRule, matchStageRules, scheduledFor } from '@/lib/comms/automation';
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

describe('scheduledFor', () => {
  it('adds the delay to now', () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    expect(scheduledFor(now, 0)).toBe('2026-01-01T00:00:00.000Z');
    expect(scheduledFor(now, 3600)).toBe('2026-01-01T01:00:00.000Z');
    expect(scheduledFor(now, null)).toBe('2026-01-01T00:00:00.000Z');
  });
});
