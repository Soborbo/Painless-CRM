import { IncomingContactSchema, ingestContact } from '@/lib/webhooks/contact';
import { createWebhookHandler } from '@/lib/webhooks/handler';

export const POST = createWebhookHandler({
  source: 'contact',
  schema: IncomingContactSchema,
  eventIdPath: (payload) => payload.event_id,
  handler: async ({ parsed }) => {
    try {
      await ingestContact(parsed);
      return { ok: true };
    } catch (err) {
      return { ok: false, reason: err instanceof Error ? err.message : 'ingest_failed' };
    }
  },
});

export const runtime = 'nodejs';
