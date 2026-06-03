import { IncomingAffiliateSchema, ingestAffiliate } from '@/lib/webhooks/affiliate';
import { createWebhookHandler } from '@/lib/webhooks/handler';

export const POST = createWebhookHandler({
  source: 'affiliate',
  schema: IncomingAffiliateSchema,
  eventIdPath: (payload) => payload.event_id,
  handler: async ({ parsed, companyId }) => {
    try {
      await ingestAffiliate(parsed, companyId);
      return { ok: true };
    } catch (err) {
      return { ok: false, reason: err instanceof Error ? err.message : 'ingest_failed' };
    }
  },
});

export const runtime = 'nodejs';
