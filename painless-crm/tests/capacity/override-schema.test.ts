import { ClearCapacityOverrideSchema, SetCapacityOverrideSchema } from '@/lib/schemas/capacity';
import { describe, expect, it } from 'vitest';

describe('SetCapacityOverrideSchema', () => {
  it('accepts a valid override', () => {
    const r = SetCapacityOverrideSchema.safeParse({
      date: '2026-06-15',
      forced_band: 'red',
      reason: 'Crew on leave',
    });
    expect(r.success).toBe(true);
  });

  it('rejects an unknown band', () => {
    expect(
      SetCapacityOverrideSchema.safeParse({
        date: '2026-06-15',
        forced_band: 'purple',
        reason: 'x but long enough',
      }).success,
    ).toBe(false);
  });

  it('rejects a malformed date', () => {
    expect(
      SetCapacityOverrideSchema.safeParse({
        date: '15/06/2026',
        forced_band: 'green',
        reason: 'valid reason',
      }).success,
    ).toBe(false);
  });

  it('requires a reason of at least 3 chars', () => {
    expect(
      SetCapacityOverrideSchema.safeParse({
        date: '2026-06-15',
        forced_band: 'green',
        reason: 'no',
      }).success,
    ).toBe(false);
  });

  it('accepts the closed band', () => {
    expect(
      SetCapacityOverrideSchema.safeParse({
        date: '2026-12-25',
        forced_band: 'closed',
        reason: 'Christmas Day',
      }).success,
    ).toBe(true);
  });
});

describe('ClearCapacityOverrideSchema', () => {
  it('accepts a valid date and rejects junk', () => {
    expect(ClearCapacityOverrideSchema.safeParse({ date: '2026-06-15' }).success).toBe(true);
    expect(ClearCapacityOverrideSchema.safeParse({ date: 'soon' }).success).toBe(false);
  });
});
