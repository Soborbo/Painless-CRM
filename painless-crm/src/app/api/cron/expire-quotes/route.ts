// Hourly sweep: flip stale draft/sent quotes to 'expired'.
//
// Cloudflare Cron triggers a POST with an empty body and an HMAC
// signature header (sha256= header) computed against `CRM_WEBHOOK_SECRET`
// over the literal string 'expire-quotes'. We reuse the webhook verifier
// rather than introducing a separate secret — the cron payload is fixed
// so any leaked signature only authorises this exact endpoint.

import { serverEnv } from '@/lib/env';
import { expireOverdueQuotes } from '@/lib/quotes/expiry';
import { isFreshTimestamp, verifyHmac } from '@/lib/webhooks/handler';
import { NextResponse } from 'next/server';

const CRON_PAYLOAD = 'expire-quotes';

export async function POST(req: Request): Promise<Response> {
  const env = serverEnv();
  const secret = env.CRM_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'cron_disabled' }, { status: 503 });
  }
  const ts = req.headers.get('x-cron-timestamp');
  if (!isFreshTimestamp(ts, Date.now())) {
    return NextResponse.json({ error: 'stale_timestamp' }, { status: 401 });
  }
  const valid = await verifyHmac(
    secret,
    `${ts}.${CRON_PAYLOAD}`,
    req.headers.get('x-cron-signature'),
  );
  if (!valid) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });
  }

  try {
    const result = await expireOverdueQuotes();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      {
        error: 'sweep_failed',
        message: err instanceof Error ? err.message.slice(0, 200) : 'unknown',
      },
      { status: 500 },
    );
  }
}

export const runtime = 'nodejs';
