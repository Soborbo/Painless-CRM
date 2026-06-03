// Hourly sweep: detect workers with a stale active clock-in (>6h, no closing
// entry) so they can be nudged to open the worker PWA and sync (Phase 09,
// ADR-011 mandate #4).
//
// Same auth shape as the other crons: Cloudflare Cron POSTs an empty body with
// an HMAC over the literal 'stale-clock-in', verified against CRM_WEBHOOK_SECRET.
//
// Web-push delivery is a later Phase 09 slice; for now the sweep detects and
// reports the count.

import { serverEnv } from '@/lib/env';
import { isFreshTimestamp, verifyHmac } from '@/lib/webhooks/handler';
import { runStaleClockInSweep } from '@/lib/worker/stale-clock-in-cron';
import { NextResponse } from 'next/server';

const CRON_PAYLOAD = 'stale-clock-in';

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
  const valid = await verifyHmac(secret, `${ts}.${CRON_PAYLOAD}`, req.headers.get('x-cron-signature'));
  if (!valid) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });
  }

  try {
    const result = await runStaleClockInSweep();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      {
        error: 'stale_sweep_failed',
        message: err instanceof Error ? err.message.slice(0, 200) : 'unknown',
      },
      { status: 500 },
    );
  }
}

export const runtime = 'nodejs';
