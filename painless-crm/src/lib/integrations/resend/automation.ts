import { serverEnv } from '@/lib/env';
import { Resend } from 'resend';

export interface AutomationEmailInput {
  to: string;
  subject: string;
  text: string;
}

const FROM = 'Painless Removals <hello@crm.painlessremovals.com>';

// Sends one automation-rule email (Phase 13 §5). Degrades to a dev-time log
// without an API key, like the other Resend helpers. Returns the provider
// message id when sent (for the messages row), or null when degraded/failed.
export async function sendAutomationEmail(input: AutomationEmailInput): Promise<string | null> {
  const env = serverEnv();
  if (!env.RESEND_API_KEY) {
    console.warn('[automation] RESEND_API_KEY missing — would email %s', input.to);
    return null;
  }
  const resend = new Resend(env.RESEND_API_KEY);
  const { data } = await resend.emails.send({
    from: FROM,
    to: input.to,
    subject: input.subject,
    text: input.text,
  });
  return data?.id ?? null;
}
