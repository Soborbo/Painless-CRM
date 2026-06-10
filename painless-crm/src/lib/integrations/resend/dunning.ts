import { serverEnv } from '@/lib/env';
import { safeSend } from './safe-send';

export interface DunningEmailInput {
  to: string;
  subject: string;
  text: string;
}

const FROM = 'Painless Removals <accounts@crm.painlessremovals.com>';

// Sends one dunning reminder (Phase 12 §9). Degrades to a dev-time log without
// an API key, like the other Resend helpers. Returns false on a provider
// rejection so the sweep can release its idempotency claim and retry tomorrow.
export async function sendDunningEmail(input: DunningEmailInput): Promise<boolean> {
  const env = serverEnv();
  if (!env.RESEND_API_KEY) {
    console.warn('[dunning] RESEND_API_KEY missing — would email %s', input.to);
    return true;
  }
  return safeSend('dunning', env.RESEND_API_KEY, { from: FROM, ...input });
}
