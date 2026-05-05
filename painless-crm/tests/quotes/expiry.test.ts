import { shouldExpire } from '@/lib/quotes/expiry';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-05-04T12:00:00Z');

describe('shouldExpire', () => {
  it('flags draft quotes whose validity has passed', () => {
    expect(shouldExpire('draft', '2026-05-04T11:00:00Z', NOW)).toBe(true);
  });

  it('flags sent quotes whose validity has passed', () => {
    expect(shouldExpire('sent', '2026-05-04T11:59:59Z', NOW)).toBe(true);
  });

  it('flags quotes whose validity is exactly now (boundary)', () => {
    expect(shouldExpire('sent', '2026-05-04T12:00:00Z', NOW)).toBe(true);
  });

  it('does not flag draft/sent quotes still in validity', () => {
    expect(shouldExpire('draft', '2026-05-05T12:00:00Z', NOW)).toBe(false);
    expect(shouldExpire('sent', '2026-05-04T12:00:01Z', NOW)).toBe(false);
  });

  it('never flags terminal statuses', () => {
    expect(shouldExpire('accepted', '2026-05-01T00:00:00Z', NOW)).toBe(false);
    expect(shouldExpire('declined', '2026-05-01T00:00:00Z', NOW)).toBe(false);
    expect(shouldExpire('expired', '2026-05-01T00:00:00Z', NOW)).toBe(false);
  });

  it('handles missing or malformed timestamps defensively', () => {
    expect(shouldExpire('sent', null, NOW)).toBe(false);
    expect(shouldExpire('sent', undefined, NOW)).toBe(false);
    expect(shouldExpire('sent', 'not-a-date', NOW)).toBe(false);
  });

  it('handles missing status defensively', () => {
    expect(shouldExpire(null, '2026-05-01T00:00:00Z', NOW)).toBe(false);
    expect(shouldExpire(undefined, '2026-05-01T00:00:00Z', NOW)).toBe(false);
  });
});
