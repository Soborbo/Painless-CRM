import { serverEnv } from '@/lib/env';
import { safeSend } from './safe-send';

export interface NotificationEmailInput {
  to: string;
  subject: string;
  text: string;
}

const FROM = 'Painless CRM <alerts@crm.painlessremovals.com>';

// Sends one per-user notification email for any frequency bucket. Mirrors
// resend/daily-digest.ts: degrades to a dev-time log when no API key is bound,
// so local runs and non-prod crons never fail on a missing secret. The bucket
// is used only as the safeSend log tag.
export async function sendNotificationEmail(
  bucket: string,
  input: NotificationEmailInput,
): Promise<boolean> {
  const env = serverEnv();
  if (!env.RESEND_API_KEY) {
    console.warn('[notify:%s] RESEND_API_KEY missing — would send to %s', bucket, input.to);
    return true;
  }
  return safeSend(`notify-${bucket}`, env.RESEND_API_KEY, { from: FROM, ...input });
}
