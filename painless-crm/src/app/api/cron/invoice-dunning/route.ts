// Daily dunning sweep: mark past-due invoices overdue and send escalating
// reminders at T+3/7/14, escalating to managers at T+30 (Phase 12 §9). Same
// auth shape as the other crons — HMAC over the literal payload string against
// CRM_WEBHOOK_SECRET.

import { serverEnv } from '@/lib/env';
import { runDunningSweep } from '@/lib/invoices/dunning-cron';
import { isFreshTimestamp, verifyHmac } from '@/lib/webhooks/handler';
import { NextResponse } from 'next/server';

const CRON_PAYLOAD = 'invoice-dunning';

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
    const result = await runDunningSweep(new Date());
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
