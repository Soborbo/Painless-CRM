import { IncomingCallbackSchema, ingestCallback } from '@/lib/webhooks/callback';
import { createWebhookHandler } from '@/lib/webhooks/handler';

export const POST = createWebhookHandler({
  source: 'callback',
  schema: IncomingCallbackSchema,
  eventIdPath: (payload) => payload.event_id,
  handler: async ({ parsed }) => {
    try {
      await ingestCallback({ ...parsed, kind: 'callback' });
      return { ok: true };
    } catch (err) {
      return { ok: false, reason: err instanceof Error ? err.message : 'ingest_failed' };
    }
  },
});

export const runtime = 'nodejs';
