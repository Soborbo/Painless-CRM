// Processes due automation-queue rows (Phase 13 §5): renders the rule's email
// template and sends it. Runs frequently (every minute). Same auth shape as the
// other crons — HMAC over the literal payload string against CRM_WEBHOOK_SECRET.

import { runAutomationQueue } from '@/lib/comms/automation-cron';
import { serverEnv } from '@/lib/env';
import { verifyHmac } from '@/lib/webhooks/handler';
import { NextResponse } from 'next/server';

const CRON_PAYLOAD = 'automation-queue';

export async function POST(req: Request): Promise<Response> {
  const env = serverEnv();
  const secret = env.CRM_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'cron_disabled' }, { status: 503 });
  }
  const valid = await verifyHmac(secret, CRON_PAYLOAD, req.headers.get('x-cron-signature'));
  if (!valid) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });
  }

  try {
    const result = await runAutomationQueue(new Date());
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      {
        error: 'processor_failed',
        message: err instanceof Error ? err.message.slice(0, 200) : 'unknown',
      },
      { status: 500 },
    );
  }
}

export const runtime = 'nodejs';
