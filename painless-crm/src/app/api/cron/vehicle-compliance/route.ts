// Daily 06:00 sweep: email each company's admins about vehicle compliance dates
// (MOT / road tax / insurance / next service) crossing the 30/14/7-day marks
// today (Phase 08 §compliance auto-reminders).
//
// Same auth shape as the other crons: Cloudflare Cron POSTs an empty body with
// an HMAC over the literal 'vehicle-compliance', verified against
// CRM_WEBHOOK_SECRET. The dedupe ledger makes the sweep idempotent.

import { serverEnv } from '@/lib/env';
import { runVehicleComplianceSweep } from '@/lib/vehicles/compliance-cron';
import { isFreshTimestamp, verifyHmac } from '@/lib/webhooks/handler';
import { NextResponse } from 'next/server';

const CRON_PAYLOAD = 'vehicle-compliance';

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
    const result = await runVehicleComplianceSweep();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      {
        error: 'compliance_sweep_failed',
        message: err instanceof Error ? err.message.slice(0, 200) : 'unknown',
      },
      { status: 500 },
    );
  }
}

export const runtime = 'nodejs';
