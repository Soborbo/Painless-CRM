import { DAMAGE_AUTO_ESCALATE_PENCE, shouldAutoEscalate } from '@/lib/damages/escalation';
import { describe, expect, it } from 'vitest';

describe('shouldAutoEscalate', () => {
  it('escalates a payout above the £500 threshold', () => {
    expect(shouldAutoEscalate(DAMAGE_AUTO_ESCALATE_PENCE + 1, false)).toBe(true);
    expect(shouldAutoEscalate(60_000, false)).toBe(true);
  });

  it('does not escalate at or below the threshold', () => {
    expect(shouldAutoEscalate(DAMAGE_AUTO_ESCALATE_PENCE, false)).toBe(false);
    expect(shouldAutoEscalate(10_000, false)).toBe(false);
  });

  it('never re-escalates an already-escalated claim', () => {
    expect(shouldAutoEscalate(100_000, true)).toBe(false);
  });

  it('does not escalate when there is no payout yet', () => {
    expect(shouldAutoEscalate(null, false)).toBe(false);
  });

  it('honours a custom threshold', () => {
    expect(shouldAutoEscalate(20_000, false, 10_000)).toBe(true);
    expect(shouldAutoEscalate(5_000, false, 10_000)).toBe(false);
  });
});
