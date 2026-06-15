import { afterEach, describe, expect, it, vi } from 'vitest';

const SECRET = 'cron-test-secret-of-sufficient-length-1234';

const envMock = vi.hoisted(() => ({ serverEnv: vi.fn() }));
vi.mock('@/lib/env', () => envMock);

const sweepMock = vi.hoisted(() => ({ runNotificationSweep: vi.fn() }));
vi.mock('@/lib/notifications/sweep', () => sweepMock);

const scanMock = vi.hoisted(() => ({ scanHighValueUncontactedLeads: vi.fn() }));
vi.mock('@/lib/notifications/high-value-leads', () => scanMock);

const flushMock = vi.hoisted(() => ({ planLondonFlush: vi.fn() }));
vi.mock('@/lib/notifications/delivery', () => flushMock);

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

function signedReq(url: string, ts: string, sig: string): Request {
  return new Request(url, {
    method: 'POST',
    headers: { 'x-cron-signature': sig, 'x-cron-timestamp': ts },
  });
}

afterEach(() => vi.clearAllMocks());

describe('POST /api/cron/notify-immediate', () => {
  const URL = 'https://x/api/cron/notify-immediate';

  it('returns 503 without a secret', async () => {
    envMock.serverEnv.mockReturnValue({ CRM_WEBHOOK_SECRET: undefined });
    const { POST } = await import('@/app/api/cron/notify-immediate/route');
    const res = await POST(new Request(URL, { method: 'POST' }));
    expect(res.status).toBe(503);
    expect(sweepMock.runNotificationSweep).not.toHaveBeenCalled();
  });

  it('rejects a stale timestamp', async () => {
    envMock.serverEnv.mockReturnValue({ CRM_WEBHOOK_SECRET: SECRET });
    const staleTs = String(Math.floor(Date.now() / 1000) - 600);
    const sig = await hmacHex(SECRET, `${staleTs}.notify-immediate`);
    const { POST } = await import('@/app/api/cron/notify-immediate/route');
    const res = await POST(signedReq(URL, staleTs, sig));
    expect(res.status).toBe(401);
  });

  it('runs the immediate sweep on a valid signature', async () => {
    envMock.serverEnv.mockReturnValue({ CRM_WEBHOOK_SECRET: SECRET });
    sweepMock.runNotificationSweep.mockResolvedValueOnce({ pending: 3, emailsSent: 1, emailsFailed: 0, janitored: 2 });
    const ts = String(Math.floor(Date.now() / 1000));
    const sig = await hmacHex(SECRET, `${ts}.notify-immediate`);
    const { POST } = await import('@/app/api/cron/notify-immediate/route');
    const res = await POST(signedReq(URL, ts, sig));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, emailsSent: 1, janitored: 2 });
    expect(sweepMock.runNotificationSweep).toHaveBeenCalledWith('immediate', expect.any(Date));
  });
});

describe('POST /api/cron/daily-digest', () => {
  const URL = 'https://x/api/cron/daily-digest';

  it('skips outside the London 09:00 window', async () => {
    envMock.serverEnv.mockReturnValue({ CRM_WEBHOOK_SECRET: SECRET });
    flushMock.planLondonFlush.mockReturnValue({ isDaily9am: false, isWeeklyMon9am: false });
    const ts = String(Math.floor(Date.now() / 1000));
    const sig = await hmacHex(SECRET, `${ts}.daily-digest`);
    const { POST } = await import('@/app/api/cron/daily-digest/route');
    const res = await POST(signedReq(URL, ts, sig));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, skipped: 'outside_london_window' });
    expect(sweepMock.runNotificationSweep).not.toHaveBeenCalled();
    expect(scanMock.scanHighValueUncontactedLeads).not.toHaveBeenCalled();
  });

  it('scans high-value leads then runs the daily sweep inside the window', async () => {
    envMock.serverEnv.mockReturnValue({ CRM_WEBHOOK_SECRET: SECRET });
    flushMock.planLondonFlush.mockReturnValue({ isDaily9am: true, isWeeklyMon9am: false });
    scanMock.scanHighValueUncontactedLeads.mockResolvedValueOnce({ scanned: 10, notified: 2 });
    sweepMock.runNotificationSweep.mockResolvedValueOnce({ pending: 5, emailsSent: 3, emailsFailed: 0, janitored: 0 });
    const ts = String(Math.floor(Date.now() / 1000));
    const sig = await hmacHex(SECRET, `${ts}.daily-digest`);
    const { POST } = await import('@/app/api/cron/daily-digest/route');
    const res = await POST(signedReq(URL, ts, sig));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, highValueLeads: 2, emailsSent: 3 });
    expect(sweepMock.runNotificationSweep).toHaveBeenCalledWith('daily', expect.any(Date));
  });
});
