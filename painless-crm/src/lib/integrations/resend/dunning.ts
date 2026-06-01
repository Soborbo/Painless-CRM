import { serverEnv } from '@/lib/env';
import { Resend } from 'resend';

export interface DunningEmailInput {
  to: string;
  subject: string;
  text: string;
}

const FROM = 'Painless Removals <accounts@crm.painlessremovals.com>';

// Sends one dunning reminder (Phase 12 §9). Degrades to a dev-time log without
// an API key, like the other Resend helpers.
export async function sendDunningEmail(input: DunningEmailInput): Promise<void> {
  const env = serverEnv();
  if (!env.RESEND_API_KEY) {
    console.warn('[dunning] RESEND_API_KEY missing — would email %s', input.to);
    return;
  }
  const resend = new Resend(env.RESEND_API_KEY);
  await resend.emails.send({ from: FROM, to: input.to, subject: input.subject, text: input.text });
}
