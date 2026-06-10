import { serverEnv } from '@/lib/env';
import { safeSend } from './safe-send';

export interface ComplaintEmailInput {
  to: string[];
  subject: string;
  text: string;
}

const FROM = 'Painless CRM <alerts@crm.painlessremovals.com>';

// Notifies the complaints owner / managers of a new or escalated complaint
// (Phase 11 §5). Degrades to a dev-time log when no API key is bound, like the
// other Resend helpers. PII note: contains only a link to the in-app ticket,
// never the customer's free-text — the body stays in the CRM behind RLS.
export async function sendComplaintEmail(input: ComplaintEmailInput): Promise<boolean> {
  if (input.to.length === 0) return true;
  const env = serverEnv();
  if (!env.RESEND_API_KEY) {
    console.warn('[complaint] RESEND_API_KEY missing — would notify %o', input.to);
    return true;
  }
  return safeSend('complaint', env.RESEND_API_KEY, { from: FROM, ...input });
}
