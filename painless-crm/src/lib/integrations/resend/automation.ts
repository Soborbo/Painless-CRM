import { serverEnv } from '@/lib/env';
import { Resend } from 'resend';

export interface AutomationEmailInput {
  to: string;
  subject: string;
  text: string;
}

// Discriminated result so the caller can tell a genuine provider rejection
// (which must NOT be logged as 'sent') from the dev-time degraded path
// (no API key). The Resend SDK does NOT throw on most API errors — it returns
// { data: null, error } — so checking `error` is mandatory (audit H3).
export type AutomationEmailResult =
  | { ok: true; id: string | null }
  | { ok: false; reason: 'no_api_key' | 'send_error'; error?: string };

const FROM = 'Painless Removals <hello@crm.painlessremovals.com>';

// Sends one automation-rule email (Phase 13 §5). Degrades to a dev-time log
// without an API key. Surfaces provider errors instead of swallowing them.
export async function sendAutomationEmail(
  input: AutomationEmailInput,
): Promise<AutomationEmailResult> {
  const env = serverEnv();
  if (!env.RESEND_API_KEY) {
    console.warn('[automation] RESEND_API_KEY missing — would email %s', input.to);
    return { ok: false, reason: 'no_api_key' };
  }
  const resend = new Resend(env.RESEND_API_KEY);
  const { data, error } = await resend.emails.send({
    from: FROM,
    to: input.to,
    subject: input.subject,
    text: input.text,
  });
  if (error) {
    return { ok: false, reason: 'send_error', error: error.message ?? 'resend_error' };
  }
  return { ok: true, id: data?.id ?? null };
}
