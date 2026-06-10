// Weekday 07:55 sweep: email each user a digest of the notifications they
// received in the last 24h, honouring their email_digest_enabled preference.
// Phase 15. Push delivery lands later (VAPID + service worker).
//
// Same auth shape as the sla-digest cron: Cloudflare Cron POSTs an empty body
// with an HMAC over the literal payload string, verified against
// CRM_WEBHOOK_SECRET. The fixed payload means a leaked signature only ever
// authorises this one endpoint.

import { serverEnv } from '@/lib/env';
import { sendDailyDigestEmail } from '@/lib/integrations/resend/daily-digest';
import { buildDailyDigests } from '@/lib/notifications/daily-digest';
import { fetchDailyDigestData } from '@/lib/queries/daily-digest';
import { isFreshTimestamp, verifyHmac } from '@/lib/webhooks/handler';
import { NextResponse } from 'next/server';

const CRON_PAYLOAD = 'daily-digest';
const DAY_MS = 24 * 60 * 60 * 1000;

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
    const since = new Date(Date.now() - DAY_MS).toISOString();
    const data = await fetchDailyDigestData(since);
    const digests = buildDailyDigests(data.notifications, data.recipients);

    let emailsSent = 0;
    for (const digest of digests) {
      await sendDailyDigestEmail({
        to: digest.recipients,
        subject: digest.subject,
        text: digest.text,
      });
      emailsSent += 1;
    }

    return NextResponse.json({
      ok: true,
      notifications: data.notifications.length,
      usersNotified: digests.length,
      emailsSent,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: 'digest_failed',
        message: err instanceof Error ? err.message.slice(0, 200) : 'unknown',
      },
      { status: 500 },
    );
  }
}

export const runtime = 'nodejs';
