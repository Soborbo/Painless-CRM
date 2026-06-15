// Weekly notification digest. Fires at 08:00 and 09:00 UTC every Monday; the
// London-local guard lets only the run where London time is Monday 09:00
// proceed, so it lands at 09:00 BST in summer and 09:00 GMT in winter. Emails
// the notifications whose recipients set the event to "weekly". Idempotent via
// notifications.email_sent_at. HMAC-guarded (ADR-040).

import { planLondonFlush } from '@/lib/notifications/delivery';
import { guardCronRequest } from '@/lib/notifications/cron-route';
import { runNotificationSweep } from '@/lib/notifications/sweep';
import { NextResponse } from 'next/server';

const CRON_PAYLOAD = 'notify-weekly';

export async function POST(req: Request): Promise<Response> {
  const denied = await guardCronRequest(req, CRON_PAYLOAD);
  if (denied) return denied;

  try {
    const now = new Date();
    if (!planLondonFlush(now).isWeeklyMon9am) {
      return NextResponse.json({ ok: true, skipped: 'outside_london_window' });
    }
    const result = await runNotificationSweep('weekly', now);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: 'sweep_failed', message: err instanceof Error ? err.message.slice(0, 200) : 'unknown' },
      { status: 500 },
    );
  }
}

export const runtime = 'nodejs';
