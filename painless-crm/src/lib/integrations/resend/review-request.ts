import { serverEnv } from '@/lib/env';
import { safeSend } from './safe-send';

export interface ReviewRequestEmailInput {
  to: string;
  subject: string;
  text: string;
  html: string;
}

const FROM = 'Painless Removals <hello@crm.painlessremovals.com>';

// Sends one universal review-request email (Phase 11 §3). Mirrors the other
// Resend helpers: degrades to a dev-time log when no API key is bound, so local
// runs and the cron in non-prod never fail on a missing secret. Returns false
// on a provider rejection so the sweep doesn't advance the request row.
export async function sendReviewRequestEmail(input: ReviewRequestEmailInput): Promise<boolean> {
  const env = serverEnv();
  if (!env.RESEND_API_KEY) {
    console.warn('[review-request] RESEND_API_KEY missing — would send to %s', input.to);
    return true;
  }
  return safeSend('review-request', env.RESEND_API_KEY, { from: FROM, ...input });
}
