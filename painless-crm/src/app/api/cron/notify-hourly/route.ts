// Top-of-the-hour sweep: emails the notifications whose recipients set the
// event to "hourly" frequency. Idempotent via notifications.email_sent_at.
// HMAC-guarded like every /api/cron/* route (ADR-040).

import { guardCronRequest } from '@/lib/notifications/cron-route';
import { runNotificationSweep } from '@/lib/notifications/sweep';
import { NextResponse } from 'next/server';

const CRON_PAYLOAD = 'notify-hourly';

export async function POST(req: Request): Promise<Response> {
  const denied = await guardCronRequest(req, CRON_PAYLOAD);
  if (denied) return denied;

  try {
    const result = await runNotificationSweep('hourly', new Date());
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: 'sweep_failed', message: err instanceof Error ? err.message.slice(0, 200) : 'unknown' },
      { status: 500 },
    );
  }
}

export const runtime = 'nodejs';
