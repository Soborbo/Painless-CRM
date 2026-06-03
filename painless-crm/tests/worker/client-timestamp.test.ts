import { boundedClientTimestamp } from '@/lib/worker/client-timestamp';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-06-10T12:00:00.000Z');

describe('boundedClientTimestamp', () => {
  it('keeps a recent in-window client timestamp (offline replay)', () => {
    const t = '2026-06-09T12:00:00.000Z'; // 1 day ago
    expect(boundedClientTimestamp(t, NOW)).toBe('2026-06-09T12:00:00.000Z');
  });

  it('falls back to server time for a forward-dated timestamp', () => {
    const future = '2026-06-10T13:00:00.000Z'; // +1h (beyond 5min skew)
    expect(boundedClientTimestamp(future, NOW)).toBe(NOW.toISOString());
  });

  it('falls back to server time for a grossly backdated timestamp', () => {
    const old = '2026-05-01T12:00:00.000Z'; // > 7 days ago
    expect(boundedClientTimestamp(old, NOW)).toBe(NOW.toISOString());
  });

  it('falls back to server time for missing/invalid input', () => {
    expect(boundedClientTimestamp(null, NOW)).toBe(NOW.toISOString());
    expect(boundedClientTimestamp(undefined, NOW)).toBe(NOW.toISOString());
    expect(boundedClientTimestamp('not-a-date', NOW)).toBe(NOW.toISOString());
  });

  it('allows a small forward skew (clock drift)', () => {
    const slightly = '2026-06-10T12:03:00.000Z'; // +3min, within 5min
    expect(boundedClientTimestamp(slightly, NOW)).toBe('2026-06-10T12:03:00.000Z');
  });
});
