import { ingestCompareMyMove } from '@/lib/webhooks/compare-my-move';
import { CmmResultSchema, cmmEnvelope } from '@/lib/webhooks/compare-my-move-schema';
import { createBodySignedWebhookHandler } from '@/lib/webhooks/handler-v3';

// Compare My Move inbound lead webhook (ADR-043). CMM must be configured to
// send JSON (our chosen format over XML) to this HTTPS endpoint. Auth, dedup
// (on quote_id) and audit are handled by the v3 body-signed shell; this route
// only wires the CMM envelope + schema + ingest. The tenant is the server-side
// WEBHOOK_COMPANY_ID, never a body value (audit H2).

export const POST = createBodySignedWebhookHandler({
  source: 'compare_my_move',
  schema: CmmResultSchema,
  getSecret: (env) => env.CMM_WEBHOOK_SECRET,
  envelope: cmmEnvelope,
  handler: async ({ parsed, companyId }) => {
    if (!companyId) {
      return { ok: false, reason: 'webhook_company_unconfigured' };
    }
    try {
      await ingestCompareMyMove(parsed, companyId);
      return { ok: true };
    } catch (err) {
      return { ok: false, reason: err instanceof Error ? err.message : 'ingest_failed' };
    }
  },
});

export const runtime = 'nodejs';
