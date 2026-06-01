import { afterEach, describe, expect, it, vi } from 'vitest';

// The guard delegates the counting to rateLimitCheck (covered by its own test);
// here we lock the guard's own contract: pass-through vs the 429 response shape.
const rlMock = vi.hoisted(() => ({ rateLimitCheck: vi.fn() }));
vi.mock('@/lib/kv/rate-limit', () => rlMock);

afterEach(() => {
  vi.clearAllMocks();
});

describe('enforceExportRateLimit', () => {
  it('returns null when the caller is under the limit', async () => {
    rlMock.rateLimitCheck.mockResolvedValue({ ok: true, limit: 10, remaining: 9, degraded: false });
    const { enforceExportRateLimit } = await import('@/lib/exports/guard');
    expect(await enforceExportRateLimit('user-1', 'customers')).toBeNull();
  });

  it('keys the limit by resource and user', async () => {
    rlMock.rateLimitCheck.mockResolvedValue({ ok: true, limit: 10, remaining: 9, degraded: false });
    const { enforceExportRateLimit, EXPORT_RATE_LIMIT } = await import('@/lib/exports/guard');
    await enforceExportRateLimit('user-9', 'jobs');
    expect(rlMock.rateLimitCheck).toHaveBeenCalledWith('export:jobs:user-9', EXPORT_RATE_LIMIT);
  });

  it('returns a 429 with retry-after + no-store when over the limit', async () => {
    rlMock.rateLimitCheck.mockResolvedValue({
      ok: false,
      limit: 10,
      remaining: 0,
      degraded: false,
    });
    const { enforceExportRateLimit, EXPORT_RATE_LIMIT } = await import('@/lib/exports/guard');
    const res = await enforceExportRateLimit('user-1', 'profit');
    expect(res).not.toBeNull();
    expect(res?.status).toBe(429);
    expect(res?.headers.get('retry-after')).toBe(String(EXPORT_RATE_LIMIT.windowSec));
    expect(res?.headers.get('cache-control')).toBe('no-store');
    expect(await res?.json()).toEqual({ error: 'rate_limited' });
  });

  it('caps exports at 10 per hour', async () => {
    const { EXPORT_RATE_LIMIT } = await import('@/lib/exports/guard');
    expect(EXPORT_RATE_LIMIT).toEqual({ windowSec: 3600, maxRequests: 10 });
  });
});
