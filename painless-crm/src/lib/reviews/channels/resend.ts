import { Resend } from 'resend';

// The review engine's send seam, implemented on Resend (replacing the engine's
// Brevo channel). Unlike lib/integrations/resend/safe-send.ts (returns boolean),
// the sweep needs the provider message id to confirm the crash-safe send-log
// row, and it must THROW on rejection so a failed send leaves the claim
// unconfirmed for the reconcile sweep (never silently advances the request).

export interface ReviewSendParams {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  text: string;
  /** Extra headers — notably List-Unsubscribe (+ One-Click) for compliance. */
  headers?: Record<string, string>;
}

export interface ReviewSendResult {
  providerId: string;
}

const FROM = 'Painless Removals <hello@crm.painlessremovals.com>';

export class ResendChannel {
  readonly kind = 'email' as const;

  constructor(private readonly apiKey: string | undefined) {}

  async send(params: ReviewSendParams): Promise<ReviewSendResult> {
    // No key bound (local/dev) → behave like the other senders' dev fallback,
    // but still return a synthetic id so the crash-safe confirm path runs.
    if (!this.apiKey) {
      return { providerId: `dev-${crypto.randomUUID()}` };
    }
    const resend = new Resend(this.apiKey);
    const { data, error } = await resend.emails.send({
      from: FROM,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
      headers: params.headers,
    });
    if (error || !data?.id) {
      throw new Error(`resend_send_failed: ${error?.message ?? 'no_message_id'}`);
    }
    return { providerId: data.id };
  }
}
