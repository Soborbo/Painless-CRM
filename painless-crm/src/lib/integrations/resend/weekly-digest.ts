import { serverEnv } from '@/lib/env';
import { safeSend } from './safe-send';

export interface WeeklyDigestEmailInput {
  to: string[];
  subject: string;
  text: string;
}

const FROM = 'Painless CRM <reports@crm.painlessremovals.com>';

// Sends one weekly performance digest to a company's managers. Mirrors
// resend/sla-digest.ts: degrades to a dev-time log when no API key is bound,
// so local runs and the cron in non-prod never fail on a missing secret.
export async function sendWeeklyDigestEmail(input: WeeklyDigestEmailInput): Promise<boolean> {
  const env = serverEnv();
  if (!env.RESEND_API_KEY) {
    console.warn('[weekly-digest] RESEND_API_KEY missing — would send to %o', input.to);
    return true;
  }
  return safeSend('weekly-digest', env.RESEND_API_KEY, { from: FROM, ...input });
}
