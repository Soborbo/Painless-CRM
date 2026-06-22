import {
  computeNext,
  dateKeyDiffDays,
  initialNextSend,
  localParts,
  parseTriggerAt,
  rampValueFor,
  roundToWindow,
} from '@/lib/reviews/engine/time';
import { describe, expect, it } from 'vitest';

const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7];

describe('localParts', () => {
  it('derives local hour and ISO weekday', () => {
    // 2026-06-14 is a Sunday (ISO weekday 7).
    const p = localParts('2026-06-14T08:30:00Z', 'UTC');
    expect(p).toEqual({ dateKey: '2026-06-14', hour: 8, weekday: 7 });
  });
});

describe('roundToWindow', () => {
  it('rounds forward to the next allowed hour on an allowed day', () => {
    const out = roundToWindow('2026-06-14T08:00:00Z', 'UTC', [10], ALL_DAYS);
    expect(out).toBe('2026-06-14T10:00:00.000Z');
  });

  it('skips disallowed weekdays', () => {
    // Sunday excluded → jump to Monday 10:00.
    const out = roundToWindow('2026-06-14T11:00:00Z', 'UTC', [10], [1, 2, 3, 4, 5, 6]);
    expect(out).toBe('2026-06-15T10:00:00.000Z');
  });
});

describe('computeNext', () => {
  it('offsets from trigger by scheduleDays[attemptsSentAfter] (Painless cadence)', () => {
    // First send: +1 day (24h) → next 10:00 window.
    const out = computeNext('2026-06-14T09:00:00Z', [1, 4, 7, 14], 0, 'UTC', [10], ALL_DAYS);
    expect(out).toBe('2026-06-15T10:00:00.000Z');
  });
  it('third follow-up offsets by +14 days', () => {
    const out = computeNext('2026-06-14T09:00:00Z', [1, 4, 7, 14], 3, 'UTC', [10], ALL_DAYS);
    expect(out).toBe('2026-06-28T10:00:00.000Z');
  });
  it('returns null past the last scheduled attempt', () => {
    const out = computeNext('2026-06-14T09:00:00Z', [1, 4, 7, 14], 4, 'UTC', [10], ALL_DAYS);
    expect(out).toBeNull();
  });
});

describe('initialNextSend', () => {
  it('schedules the first send at scheduleDays[0] after trigger', () => {
    const out = initialNextSend('2026-06-14T09:00:00Z', [1, 4, 7, 14], 'UTC', [10], ALL_DAYS);
    expect(out).toBe('2026-06-15T10:00:00.000Z');
  });
});

describe('ramp', () => {
  it('uses the ramp value for the current sending day, capped by daily_send_cap', () => {
    expect(rampValueFor([50, 100, 200], null, 1000, '2026-06-14', 'UTC')).toBe(50);
  });
  it('settles at the last ramp value and respects the cap', () => {
    expect(rampValueFor([50, 100, 9999], '2026-06-10', 1000, '2026-06-14', 'UTC')).toBe(1000);
  });
  it('falls back to daily_send_cap when ramp is null', () => {
    expect(rampValueFor(null, null, 777, '2026-06-14', 'UTC')).toBe(777);
  });
});

describe('parseTriggerAt', () => {
  const now = new Date('2026-06-20T12:00:00.000Z');
  it('passes through a valid ISO/date string', () => {
    expect(parseTriggerAt('2026-06-14', now)).toBe('2026-06-14T00:00:00.000Z');
  });
  it('falls back to now when absent', () => {
    expect(parseTriggerAt(undefined, now)).toBe('2026-06-20T12:00:00.000Z');
    expect(parseTriggerAt(null, now)).toBe('2026-06-20T12:00:00.000Z');
  });
  it('falls back to now on an unparseable string instead of throwing', () => {
    expect(parseTriggerAt('next tuesday', now)).toBe('2026-06-20T12:00:00.000Z');
    expect(parseTriggerAt('', now)).toBe('2026-06-20T12:00:00.000Z');
  });
});

describe('dateKeyDiffDays', () => {
  it('counts whole days', () => {
    expect(dateKeyDiffDays('2026-06-10', '2026-06-14')).toBe(4);
  });
});
