import { Resend } from 'resend';

export interface SafeSendInput {
  from: string;
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
}

// Failure-aware wrapper shared by the cron senders. The Resend SDK reports
// provider rejections in the response (`{ error }`) rather than throwing, so a
// bare `await send()` silently drops the email (audit H3 fixed this for the
// automation path; this extends it to every cron sender). Returns true only
// when the provider accepted the message. The error log carries the tag and
// provider message only — never the recipient (PII rule).
export async function safeSend(
  tag: string,
  apiKey: string,
  input: SafeSendInput,
): Promise<boolean> {
  const resend = new Resend(apiKey);
  try {
    const { error } = await resend.emails.send(input);
    if (error) {
      console.error('[%s] send failed: %s', tag, error.message ?? 'resend_error');
      return false;
    }
    return true;
  } catch (err) {
    console.error('[%s] send threw: %s', tag, err instanceof Error ? err.message : 'unknown');
    return false;
  }
}
