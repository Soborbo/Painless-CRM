import {
  canTransition,
  isEscalationDue,
  isFirstResponseBreached,
  severityFromSelfAssessed,
} from '@/lib/complaints/state-machine';
import { describe, expect, it } from 'vitest';

const T0 = new Date('2026-01-01T00:00:00.000Z');
const plus = (ms: number) => new Date(T0.getTime() + ms);
const HOUR = 3600_000;
const DAY = 24 * HOUR;

describe('complaints state machine', () => {
  it('allows valid transitions and blocks invalid ones', () => {
    expect(canTransition('new', 'investigating')).toBe(true);
    expect(canTransition('new', 'resolved')).toBe(true);
    expect(canTransition('investigating', 'escalated')).toBe(true);
    expect(canTransition('escalated', 'resolved')).toBe(true);
    // resolved is terminal
    expect(canTransition('resolved', 'investigating')).toBe(false);
    expect(canTransition('new', 'new')).toBe(false);
  });

  it('maps customer self-assessment to internal severity (never critical)', () => {
    expect(severityFromSelfAssessed('minor')).toBe('low');
    expect(severityFromSelfAssessed('needs_fix')).toBe('medium');
    expect(severityFromSelfAssessed('major')).toBe('high');
  });

  it('escalates open complaints at 7 days, never resolved/escalated ones', () => {
    expect(isEscalationDue(T0, 'new', plus(6 * DAY))).toBe(false);
    expect(isEscalationDue(T0, 'new', plus(7 * DAY))).toBe(true);
    expect(isEscalationDue(T0, 'investigating', plus(8 * DAY))).toBe(true);
    expect(isEscalationDue(T0, 'resolved', plus(30 * DAY))).toBe(false);
    expect(isEscalationDue(T0, 'escalated', plus(30 * DAY))).toBe(false);
  });

  it('flags a first-response SLA breach only when unanswered past 24h', () => {
    expect(isFirstResponseBreached(T0, null, plus(23 * HOUR))).toBe(false);
    expect(isFirstResponseBreached(T0, null, plus(24 * HOUR))).toBe(true);
    expect(isFirstResponseBreached(T0, plus(HOUR).toISOString(), plus(48 * HOUR))).toBe(false);
  });
});
