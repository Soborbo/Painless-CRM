import { type RateLimitOptions, checkRateLimitWith, rateLimitWindowKey } from '@/lib/kv/rate-limit';
import { describe, expect, it } from 'vitest';

interface PutCall {
  key: string;
  value: string;
  ttl: number | undefined;
}

function mockKV(initial: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(initial));
  const puts: PutCall[] = [];
  return {
    puts,
    store,
    get: async (key: string) => store.get(key) ?? null,
    put: async (key: string, value: string, options?: { expirationTtl?: number }) => {
      store.set(key, value);
      puts.push({ key, value, ttl: options?.expirationTtl });
    },
  };
}

const HOURLY: RateLimitOptions = { windowSec: 3600, maxRequests: 10 };

describe('rateLimitWindowKey', () => {
  it('buckets by floor(now / window) so each window has its own key', () => {
    const w = 3600;
    const t0 = 472_222 * w * 1000; // anchored to a window boundary
    const sameWindow = t0 + 3599 * 1000;
    const nextWindow = t0 + 3600 * 1000;
    expect(rateLimitWindowKey('export:jobs:u1', w, t0)).toBe(
      rateLimitWindowKey('export:jobs:u1', w, sameWindow),
    );
    expect(rateLimitWindowKey('export:jobs:u1', w, t0)).not.toBe(
      rateLimitWindowKey('export:jobs:u1', w, nextWindow),
    );
  });
});

describe('checkRateLimitWith', () => {
  it('degrades open when no KV is available', async () => {
    const r = await checkRateLimitWith(null, 'export:jobs:u1', HOURLY, 0);
    expect(r).toEqual({ ok: true, limit: 10, remaining: 10, degraded: true });
  });

  it('allows the first request and writes a counter of 1 with the window TTL', async () => {
    const kv = mockKV();
    const r = await checkRateLimitWith(kv, 'export:jobs:u1', HOURLY, 0);
    expect(r.ok).toBe(true);
    expect(r.remaining).toBe(9);
    expect(kv.puts).toHaveLength(1);
    expect(kv.puts[0]?.value).toBe('1');
    expect(kv.puts[0]?.ttl).toBe(3600);
  });

  it('counts up to the limit then rejects without further writes', async () => {
    const kv = mockKV();
    const key = 'export:customers:u2';
    for (let i = 0; i < 10; i++) {
      const r = await checkRateLimitWith(kv, key, HOURLY, 0);
      expect(r.ok).toBe(true);
    }
    const blocked = await checkRateLimitWith(kv, key, HOURLY, 0);
    expect(blocked).toEqual({ ok: false, limit: 10, remaining: 0, degraded: false });
    // 10 allowed writes, none for the rejected 11th.
    expect(kv.puts).toHaveLength(10);
  });

  it('isolates counters per key (one user does not consume another budget)', async () => {
    const kv = mockKV();
    for (let i = 0; i < 10; i++) {
      await checkRateLimitWith(kv, 'export:jobs:u1', HOURLY, 0);
    }
    const other = await checkRateLimitWith(kv, 'export:jobs:u2', HOURLY, 0);
    expect(other.ok).toBe(true);
  });

  it('resets the budget when the window rolls over', async () => {
    const kv = mockKV();
    const key = 'export:profit:u3';
    for (let i = 0; i < 10; i++) {
      await checkRateLimitWith(kv, key, HOURLY, 0);
    }
    expect((await checkRateLimitWith(kv, key, HOURLY, 0)).ok).toBe(false);
    // Advance past the window boundary → fresh bucket, allowed again.
    const nextWindowMs = 3600 * 1000;
    expect((await checkRateLimitWith(kv, key, HOURLY, nextWindowMs)).ok).toBe(true);
  });

  it('treats a corrupt counter value as zero', async () => {
    const kv = mockKV();
    const key = rateLimitWindowKey('export:jobs:u9', HOURLY.windowSec, 0);
    kv.store.set(key, 'not-a-number');
    const r = await checkRateLimitWith(kv, 'export:jobs:u9', HOURLY, 0);
    expect(r.ok).toBe(true);
    expect(r.remaining).toBe(9);
  });
});
