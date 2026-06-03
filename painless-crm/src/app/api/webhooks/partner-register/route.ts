import { createWebhookHandler } from '@/lib/webhooks/handler';
import {
  IncomingPartnerRegisterSchema,
  ingestPartnerRegister,
} from '@/lib/webhooks/partner-register';

export const POST = createWebhookHandler({
  source: 'partner_register',
  schema: IncomingPartnerRegisterSchema,
  eventIdPath: (payload) => payload.event_id,
  handler: async ({ parsed, companyId }) => {
    try {
      await ingestPartnerRegister(parsed, companyId);
      return { ok: true };
    } catch (err) {
      return { ok: false, reason: err instanceof Error ? err.message : 'ingest_failed' };
    }
  },
});

export const runtime = 'nodejs';
