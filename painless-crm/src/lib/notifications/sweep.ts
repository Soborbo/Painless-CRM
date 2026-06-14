import { sendNotificationEmail } from '@/lib/integrations/resend/notification-email';
import {
  fetchPendingEmailNotifications,
  fetchRecipientDeliveries,
  stampEmailed,
} from '@/lib/queries/notification-delivery';
import { planSweep } from './delivery';
import type { Frequency } from './prefs';

// Cron-side runner for one frequency bucket: load pending notifications +
// recipient prefs, plan the bucket purely, send each email and stamp its rows
// on success (failed sends stay pending and retry next sweep), and always stamp
// the janitor rows. Idempotent via notifications.email_sent_at.

export interface SweepResult {
  pending: number;
  emailsSent: number;
  emailsFailed: number;
  janitored: number;
}

export async function runNotificationSweep(
  bucket: Exclude<Frequency, 'off'>,
  now: Date = new Date(),
): Promise<SweepResult> {
  const pending = await fetchPendingEmailNotifications();
  if (pending.length === 0) {
    return { pending: 0, emailsSent: 0, emailsFailed: 0, janitored: 0 };
  }

  const recipientIds = pending.map((n) => n.recipient_user_id);
  const recipients = await fetchRecipientDeliveries(recipientIds);
  const plan = planSweep(bucket, pending, recipients);

  const nowIso = now.toISOString();
  let emailsSent = 0;
  let emailsFailed = 0;
  for (const email of plan.emails) {
    const sent = await sendNotificationEmail(bucket, {
      to: email.to,
      subject: email.subject,
      text: email.text,
    });
    if (sent) {
      emailsSent += 1;
      await stampEmailed(email.ids, nowIso);
    } else {
      emailsFailed += 1;
    }
  }

  await stampEmailed(plan.janitorIds, nowIso);

  return {
    pending: pending.length,
    emailsSent,
    emailsFailed,
    janitored: plan.janitorIds.length,
  };
}
