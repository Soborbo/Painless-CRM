// Daily 9am sweep: email each company's managers the leads past their
// first-response SLA. Phase 06b §1 v0.1 notification fallback (push lands in
// Phase 15).
//
// Same auth shape as the expire-quotes cron: Cloudflare Cron POSTs an empty
// body with an HMAC over the literal payload string, verified against
// CRM_WEBHOOK_SECRET. The fixed payload means a leaked signature only ever
// authorises this one endpoint.

import { serverEnv } from '@/lib/env';
import { sendSlaDigestEmail } from '@/lib/integrations/resend/sla-digest';
import { buildCompanyDigests } from '@/lib/jobs/sla-digest';
import { createNotification } from '@/lib/notifications/create';
import { selectBreachNotifications } from '@/lib/notifications/sla-breach';
import { fetchNotifiedBreachJobIds, fetchOverdueDigestData } from '@/lib/queries/sla-overdue';
import { isFreshTimestamp, verifyHmac } from '@/lib/webhooks/handler';
import { NextResponse } from 'next/server';

const CRON_PAYLOAD = 'sla-digest';

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
    const now = new Date();
    const { leads, managers } = await fetchOverdueDigestData(now);
    const digests = buildCompanyDigests(leads, managers, now);

    let emailsSent = 0;
    for (const digest of digests) {
      await sendSlaDigestEmail({
        to: digest.recipients,
        subject: digest.subject,
        text: digest.text,
      });
      emailsSent += 1;
    }

    // In-app breach notifications to the assigned rep — deduped against any
    // breach notification already sent for that job, so the daily run never
    // re-notifies the same lead (Phase 15).
    const alreadyNotified = await fetchNotifiedBreachJobIds(leads.map((l) => l.job_id));
    const breaches = selectBreachNotifications(leads, alreadyNotified);
    for (const b of breaches) {
      await createNotification({
        companyId: b.companyId,
        recipientUserId: b.recipientUserId,
        type: 'sla_breach',
        title: `Lead ${b.jobNumber} is past its first-response SLA`,
        linkUrl: '/dashboard/sla',
        relatedEntityType: 'job',
        relatedEntityId: b.jobId,
        priority: 'urgent',
      });
    }

    return NextResponse.json({
      ok: true,
      overdueLeads: leads.length,
      companiesNotified: digests.length,
      emailsSent,
      breachNotifications: breaches.length,
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
