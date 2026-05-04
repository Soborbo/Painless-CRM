import { IncomingQuoteSchema, ingestQuote } from '@/lib/jobs/ingest';
import { createWebhookHandler } from '@/lib/webhooks/handler';

export const POST = createWebhookHandler({
  source: 'quote',
  schema: IncomingQuoteSchema,
  eventIdPath: (payload) => payload.event_id,
  handler: async ({ parsed }) => {
    try {
      await ingestQuote(parsed);
      return { ok: true };
    } catch (err) {
      return { ok: false, reason: err instanceof Error ? err.message : 'ingest_failed' };
    }
  },
});

export const runtime = 'nodejs';
