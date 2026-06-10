import { serverEnv } from '@/lib/env';
import { safeSend } from './safe-send';

export interface SlaDigestEmailInput {
  to: string[];
  subject: string;
  text: string;
}

const FROM = 'Painless CRM <alerts@crm.painlessremovals.com>';

// Sends one SLA overdue-lead digest to a company's managers. Mirrors
// resend/invite.ts: degrades to a dev-time log when no API key is bound, so
// local runs and the cron in non-prod never fail on a missing secret.
export async function sendSlaDigestEmail(input: SlaDigestEmailInput): Promise<boolean> {
  const env = serverEnv();
  if (!env.RESEND_API_KEY) {
    console.warn('[sla-digest] RESEND_API_KEY missing — would send to %o', input.to);
    return true;
  }
  return safeSend('sla-digest', env.RESEND_API_KEY, { from: FROM, ...input });
}
