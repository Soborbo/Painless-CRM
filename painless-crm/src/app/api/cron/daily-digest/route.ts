// Daily notification digest (ADR-040). Fires at 08:00 and 09:00 UTC; the
// London-local guard lets only the run where London time is 09:00 proceed, so
// it lands at 09:00 BST in summer and 09:00 GMT in winter. Before sweeping, it
// runs the high-value-uncontacted-lead scan so those notifications go out in
// the same email. Emails the notifications whose recipients set the event to
// "daily". Idempotent via notifications.email_sent_at.
//
// HMAC-guarded like every /api/cron/* route: a leaked signature only ever
// authorises this one endpoint (fixed CRON_PAYLOAD).

import { guardCronRequest } from '@/lib/notifications/cron-route';
import { planLondonFlush } from '@/lib/notifications/delivery';
import { scanHighValueUncontactedLeads } from '@/lib/notifications/high-value-leads';
import { runNotificationSweep } from '@/lib/notifications/sweep';
import { NextResponse } from 'next/server';

const CRON_PAYLOAD = 'daily-digest';

export async function POST(req: Request): Promise<Response> {
  const denied = await guardCronRequest(req, CRON_PAYLOAD);
  if (denied) return denied;

  try {
    const now = new Date();
    if (!planLondonFlush(now).isDaily9am) {
      return NextResponse.json({ ok: true, skipped: 'outside_london_window' });
    }
    const scan = await scanHighValueUncontactedLeads();
    const sweep = await runNotificationSweep('daily', now);
    return NextResponse.json({ ok: true, highValueLeads: scan.notified, ...sweep });
  } catch (err) {
    return NextResponse.json(
      { error: 'digest_failed', message: err instanceof Error ? err.message.slice(0, 200) : 'unknown' },
      { status: 500 },
    );
  }
}

export const runtime = 'nodejs';
