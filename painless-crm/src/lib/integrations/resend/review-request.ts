import { serverEnv } from '@/lib/env';
import { Resend } from 'resend';

export interface ReviewRequestEmailInput {
  to: string;
  subject: string;
  text: string;
  html: string;
}

const FROM = 'Painless Removals <hello@crm.painlessremovals.com>';

// Sends one universal review-request email (Phase 11 §3). Mirrors the other
// Resend helpers: degrades to a dev-time log when no API key is bound, so local
// runs and the cron in non-prod never fail on a missing secret.
export async function sendReviewRequestEmail(input: ReviewRequestEmailInput): Promise<void> {
  const env = serverEnv();
  if (!env.RESEND_API_KEY) {
    console.warn('[review-request] RESEND_API_KEY missing — would send to %s', input.to);
    return;
  }

  const resend = new Resend(env.RESEND_API_KEY);
  await resend.emails.send({
    from: FROM,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  });
}
