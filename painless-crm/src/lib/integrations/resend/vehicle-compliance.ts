import { serverEnv } from '@/lib/env';
import { Resend } from 'resend';

export interface VehicleComplianceEmailInput {
  to: string[];
  subject: string;
  text: string;
}

const FROM = 'Painless CRM <alerts@crm.painlessremovals.com>';

// Sends one vehicle-compliance reminder digest to a company's admins. Mirrors
// resend/sla-digest.ts: degrades to a dev-time log when no API key is bound, so
// local runs and the cron in non-prod never fail on a missing secret.
export async function sendVehicleComplianceEmail(
  input: VehicleComplianceEmailInput,
): Promise<void> {
  const env = serverEnv();
  if (!env.RESEND_API_KEY) {
    console.warn('[vehicle-compliance] RESEND_API_KEY missing — would send to %o', input.to);
    return;
  }

  const resend = new Resend(env.RESEND_API_KEY);
  await resend.emails.send({
    from: FROM,
    to: input.to,
    subject: input.subject,
    text: input.text,
  });
}
