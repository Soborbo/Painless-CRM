import { serverEnv } from '@/lib/env';
import { safeSend } from './safe-send';

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
): Promise<boolean> {
  const env = serverEnv();
  if (!env.RESEND_API_KEY) {
    console.warn('[vehicle-compliance] RESEND_API_KEY missing — would send to %o', input.to);
    return true;
  }
  return safeSend('vehicle-compliance', env.RESEND_API_KEY, { from: FROM, ...input });
}
