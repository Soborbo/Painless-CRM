import { serverEnv } from '@/lib/env';
import { Resend } from 'resend';

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
export async function sendComplaintEmail(input: ComplaintEmailInput): Promise<void> {
  if (input.to.length === 0) return;
  const env = serverEnv();
  if (!env.RESEND_API_KEY) {
    console.warn('[complaint] RESEND_API_KEY missing — would notify %o', input.to);
    return;
  }
  const resend = new Resend(env.RESEND_API_KEY);
  await resend.emails.send({ from: FROM, to: input.to, subject: input.subject, text: input.text });
}
