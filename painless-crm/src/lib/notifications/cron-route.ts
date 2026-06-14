import { serverEnv } from '@/lib/env';
import { isFreshTimestamp, verifyHmac } from '@/lib/webhooks/handler';
import { NextResponse } from 'next/server';

// Shared HMAC guard for the notification cron routes. Mirrors the inline guard
// used by every /api/cron/* route: 503 when the secret is unset, 401 on a
// stale timestamp or bad signature. Returns null when the request is authentic,
// so the route proceeds. Keeps the four notify routes free of boilerplate.
export async function guardCronRequest(req: Request, payload: string): Promise<Response | null> {
  const secret = serverEnv().CRM_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: 'cron_disabled' }, { status: 503 });

  const ts = req.headers.get('x-cron-timestamp');
  if (!isFreshTimestamp(ts, Date.now())) {
    return NextResponse.json({ error: 'stale_timestamp' }, { status: 401 });
  }
  const valid = await verifyHmac(secret, `${ts}.${payload}`, req.headers.get('x-cron-signature'));
  if (!valid) return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });
  return null;
}
