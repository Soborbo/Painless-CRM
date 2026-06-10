// Nightly sweep: recompute every company's capacity bands and broadcast the
// 6-week window to KV (Phase 07 §1/§2). Mirrors the expire-quotes cron: a
// Cloudflare Cron POSTs an empty body with an HMAC signature over the literal
// 'recompute-availability', verified against CRM_WEBHOOK_SECRET. The KV write
// degrades to a no-op when the binding is absent, so this is safe to run in
// any environment.

import { recomputeAllAvailability } from '@/lib/capacity/recompute';
import { serverEnv } from '@/lib/env';
import { isFreshTimestamp, verifyHmac } from '@/lib/webhooks/handler';
import { NextResponse } from 'next/server';

const CRON_PAYLOAD = 'recompute-availability';

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
    const result = await recomputeAllAvailability();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      {
        error: 'recompute_failed',
        message: err instanceof Error ? err.message.slice(0, 200) : 'unknown',
      },
      { status: 500 },
    );
  }
}

export const runtime = 'nodejs';
