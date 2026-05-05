import { afterEach, describe, expect, it, vi } from 'vitest';

const SECRET = 'cron-test-secret-of-sufficient-length-1234';

const envMock = vi.hoisted(() => ({
  serverEnv: vi.fn(),
}));
vi.mock('@/lib/env', () => envMock);

const expiryMock = vi.hoisted(() => ({
  expireOverdueQuotes: vi.fn(),
}));
vi.mock('@/lib/quotes/expiry', () => expiryMock);

async function hmacHex(secret: string, body: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(body));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/cron/expire-quotes', () => {
  it('returns 503 when CRM_WEBHOOK_SECRET is not configured', async () => {
    envMock.serverEnv.mockReturnValue({ CRM_WEBHOOK_SECRET: undefined });
    const { POST } = await import('@/app/api/cron/expire-quotes/route');
    const res = await POST(new Request('https://x/api/cron/expire-quotes', { method: 'POST' }));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'cron_disabled' });
    expect(expiryMock.expireOverdueQuotes).not.toHaveBeenCalled();
  });

  it('rejects requests with no signature', async () => {
    envMock.serverEnv.mockReturnValue({ CRM_WEBHOOK_SECRET: SECRET });
    const { POST } = await import('@/app/api/cron/expire-quotes/route');
    const res = await POST(new Request('https://x/api/cron/expire-quotes', { method: 'POST' }));
    expect(res.status).toBe(401);
    expect(expiryMock.expireOverdueQuotes).not.toHaveBeenCalled();
  });

  it('rejects requests with a wrong signature', async () => {
    envMock.serverEnv.mockReturnValue({ CRM_WEBHOOK_SECRET: SECRET });
    const { POST } = await import('@/app/api/cron/expire-quotes/route');
    const res = await POST(
      new Request('https://x/api/cron/expire-quotes', {
        method: 'POST',
        headers: { 'x-cron-signature': 'sha256=deadbeef' },
      }),
    );
    expect(res.status).toBe(401);
  });

  it('runs the sweep on a valid signature and returns the count', async () => {
    envMock.serverEnv.mockReturnValue({ CRM_WEBHOOK_SECRET: SECRET });
    expiryMock.expireOverdueQuotes.mockResolvedValueOnce({ expired_count: 4 });
    const sig = await hmacHex(SECRET, 'expire-quotes');
    const { POST } = await import('@/app/api/cron/expire-quotes/route');
    const res = await POST(
      new Request('https://x/api/cron/expire-quotes', {
        method: 'POST',
        headers: { 'x-cron-signature': sig },
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, expired_count: 4 });
    expect(expiryMock.expireOverdueQuotes).toHaveBeenCalledTimes(1);
  });

  it('returns 500 when the sweep throws', async () => {
    envMock.serverEnv.mockReturnValue({ CRM_WEBHOOK_SECRET: SECRET });
    expiryMock.expireOverdueQuotes.mockRejectedValueOnce(new Error('db down'));
    const sig = await hmacHex(SECRET, 'expire-quotes');
    const { POST } = await import('@/app/api/cron/expire-quotes/route');
    const res = await POST(
      new Request('https://x/api/cron/expire-quotes', {
        method: 'POST',
        headers: { 'x-cron-signature': sig },
      }),
    );
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('sweep_failed');
  });
});
