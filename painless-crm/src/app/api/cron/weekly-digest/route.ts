// Weekly Monday-morning sweep: email each company's managers a performance
// digest — this week vs last week (leads, quotes, acceptances, jobs won and
// revenue). Phase 14 reporting. Push lands in Phase 15.
//
// Same auth shape as the sla-digest cron: Cloudflare Cron POSTs an empty body
// with an HMAC over the literal payload string, verified against
// CRM_WEBHOOK_SECRET. The fixed payload means a leaked signature only ever
// authorises this one endpoint.

import { serverEnv } from '@/lib/env';
import { sendWeeklyDigestEmail } from '@/lib/integrations/resend/weekly-digest';
import { fetchWeeklyDigestData } from '@/lib/queries/weekly-digest';
import { kpiWindows } from '@/lib/reports/kpi';
import { buildWeeklyDigests } from '@/lib/reports/weekly-digest';
import { isFreshTimestamp, verifyHmac } from '@/lib/webhooks/handler';
import { NextResponse } from 'next/server';

const CRON_PAYLOAD = 'weekly-digest';

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
    const now = new Date();
    const windows = kpiWindows(now, 'week');
    const data = await fetchWeeklyDigestData(windows);
    const digests = buildWeeklyDigests({ ...data, windows, now });

    let emailsSent = 0;
    for (const digest of digests) {
      await sendWeeklyDigestEmail({
        to: digest.recipients,
        subject: digest.subject,
        text: digest.text,
      });
      emailsSent += 1;
    }

    return NextResponse.json({
      ok: true,
      companiesNotified: digests.length,
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
