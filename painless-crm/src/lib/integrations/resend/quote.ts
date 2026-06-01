import { serverEnv } from '@/lib/env';
import { formatDate, formatPence } from '@/lib/utils/format';
import { Resend } from 'resend';

// Transactional "your quote is ready" email. Sent (best-effort) when a rep
// marks a quote as sent — the customer gets the accept link straight away.
// Mirrors invite.ts: plain-text body, dev fallback when no RESEND_API_KEY.
// Email copy stays English like the other transactional templates.

export type QuoteEmailInput = {
  to: string;
  customerName: string;
  shareUrl: string;
  totalPence: number | null;
  validUntil: string | null;
};

const FROM = 'Painless Removals <quotes@crm.painlessremovals.com>';

// Pure renderer — kept separate so the copy is unit-testable.
export function renderQuoteEmail(input: QuoteEmailInput): { subject: string; text: string } {
  const lines = [
    `Hi ${input.customerName},`,
    '',
    'Thanks for your enquiry — your removal quote is ready.',
  ];
  if (input.totalPence !== null) {
    lines.push('', `Quote total: ${formatPence(input.totalPence)}`);
  }
  lines.push('', `View and accept your quote: ${input.shareUrl}`);
  if (input.validUntil) {
    lines.push('', `This link is valid until ${formatDate(input.validUntil)}.`);
  }
  lines.push('', 'Painless Removals');
  return { subject: 'Your Painless Removals quote', text: lines.join('\n') };
}

export async function sendQuoteEmail(input: QuoteEmailInput): Promise<void> {
  const env = serverEnv();
  const { subject, text } = renderQuoteEmail(input);

  if (!env.RESEND_API_KEY) {
    console.warn(
      '[quote-email] RESEND_API_KEY missing — would send to %s: %s',
      input.to,
      input.shareUrl,
    );
    return;
  }

  const resend = new Resend(env.RESEND_API_KEY);
  await resend.emails.send({ from: FROM, to: input.to, subject, text });
}
