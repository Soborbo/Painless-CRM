// Hourly sweep: send the universal review request 24h after a job is paid, then
// follow up at +7d and +14d if the customer hasn't clicked either link
// (Phase 11 §3/§4, ADR-010). Same auth shape as the other crons: an HMAC over
// the literal payload string, verified against CRM_WEBHOOK_SECRET.

import { serverEnv } from '@/lib/env';
import { runReviewRequestSweep } from '@/lib/reviews/review-cron';
import { isFreshTimestamp, verifyHmac } from '@/lib/webhooks/handler';
import { NextResponse } from 'next/server';

const CRON_PAYLOAD = 'review-requests';

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
    const result = await runReviewRequestSweep(new Date());
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
