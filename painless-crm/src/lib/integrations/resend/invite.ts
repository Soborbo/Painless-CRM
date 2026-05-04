import { serverEnv } from '@/lib/env';
import { Resend } from 'resend';

export type InviteEmailInput = {
  to: string;
  inviterName: string;
  acceptUrl: string;
};

const FROM = 'Painless CRM <invitations@crm.painlessremovals.com>';

export async function sendInviteEmail(input: InviteEmailInput): Promise<void> {
  const env = serverEnv();
  if (!env.RESEND_API_KEY) {
    // Dev fallback: log the invite link instead of sending. Real env always has the key.
    console.warn(
      '[invite] RESEND_API_KEY missing — would send to %s: %s',
      input.to,
      input.acceptUrl,
    );
    return;
  }

  const resend = new Resend(env.RESEND_API_KEY);
  await resend.emails.send({
    from: FROM,
    to: input.to,
    subject: 'You have been invited to Painless CRM',
    text: [
      `${input.inviterName} invited you to join Painless CRM.`,
      '',
      `Accept your invite: ${input.acceptUrl}`,
      '',
      'This link expires in 7 days.',
    ].join('\n'),
  });
}
