// Inbound webhook handler v3 — body-signed variant for THIRD-PARTY providers
// whose signature travels inside the JSON body rather than in our first-party
// `x-webhook-*` headers (Compare My Move, ADR-043). The v2 shell in handler.ts
// is unchanged and remains the entry point for first-party (painlessremovals)
// webhooks; this is its sanctioned sibling for providers we don't control the
// sender of. Both dedup through the same `webhook_events` table so the audit
// trail and idempotency guarantees stay identical (CLAUDE.md rule 14 intent).
//
// Why a separate shell: the provider computes HMAC over an arbitrary signed
// string (e.g. `timestamp + token`), NOT over the raw body, and there is no
// schema-version header or per-request freshness header — so v2's three header
// gates simply don't apply. We still reuse v2's constant-time `verifyHmac`.

import { serverEnv, type ServerEnvShape } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import type { ZodTypeAny, infer as zInfer } from 'zod';
import { verifyHmac } from './handler';

export type WebhookOutcome = { ok: true } | { ok: false; reason: string };

export interface BodySignedHandlerArgs<T> {
  parsed: T;
  rawBody: string;
  receivedAt: Date;
  source: string;
  eventId: string;
  /** Server-resolved tenant (env WEBHOOK_COMPANY_ID); handlers MUST prefer this
   *  over any body-supplied company_id (audit H2). null when unconfigured. */
  companyId: string | null;
}

export interface BodySignedEnvelope<P> {
  /** The exact string the provider HMAC-signed (e.g. `${timestamp}${token}`). */
  signedString: string;
  /** The hex digest the provider sent (their `signature` field). */
  signature: string | null;
  /** The inner payload to schema-validate (e.g. the `result` object). */
  payload: P;
  /** Idempotency key for `webhook_events` dedup (e.g. the provider lead id). */
  eventId: string;
}

export interface BodySignedRouteSpec<S extends ZodTypeAny> {
  source: string;
  schema: S;
  /** Which env var holds the shared secret. Absent value => 503 disabled. */
  getSecret: (env: ServerEnvShape) => string | undefined;
  /** Pull auth material + dedup id + payload out of the parsed JSON body.
   *  Return null when the envelope is structurally unusable (=> 400). */
  envelope: (json: Record<string, unknown>) => BodySignedEnvelope<unknown> | null;
  handler: (args: BodySignedHandlerArgs<zInfer<S>>) => Promise<WebhookOutcome>;
}

interface DedupResult {
  inserted: boolean;
  webhookEventId?: string;
}

async function recordIncoming(
  source: string,
  eventId: string,
  payload: unknown,
): Promise<DedupResult> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('webhook_events')
    .insert({ source, event_id: eventId, event_type: source, payload })
    .select('id')
    .single();
  if (error) {
    if (error.code === '23505') return { inserted: false };
    throw error;
  }
  return { inserted: true, webhookEventId: data.id as string };
}

async function stampOutcome(
  webhookEventId: string,
  result: 'success' | 'failed',
  errorMessage?: string,
): Promise<void> {
  const supabase = createAdminClient();
  await supabase
    .from('webhook_events')
    .update({ processed_at: new Date().toISOString(), result, error_message: errorMessage ?? null })
    .eq('id', webhookEventId);
}

export function createBodySignedWebhookHandler<S extends ZodTypeAny>(
  spec: BodySignedRouteSpec<S>,
) {
  return async function POST(req: Request): Promise<Response> {
    const env = serverEnv();
    const secret = spec.getSecret(env);
    if (!secret) {
      return NextResponse.json({ error: 'webhook_disabled' }, { status: 503 });
    }

    const body = await req.text();
    let json: unknown;
    try {
      json = JSON.parse(body);
    } catch {
      return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
    }
    if (typeof json !== 'object' || json === null) {
      return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
    }

    const env2 = spec.envelope(json as Record<string, unknown>);
    if (!env2 || !env2.eventId) {
      return NextResponse.json({ error: 'invalid_envelope' }, { status: 400 });
    }

    // Auth gate — HMAC over the provider's signed string, constant-time compare.
    // The signed string includes the provider's token, so the HMAC already binds
    // it; verifying the signature with the shared secret is complete auth.
    const valid = await verifyHmac(secret, env2.signedString, env2.signature);
    if (!valid) {
      return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });
    }

    const parsed = spec.schema.safeParse(env2.payload);
    if (!parsed.success) {
      return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
    }

    // Dedup — a provider that retries the same lead (CMM retries up to 6×) hits
    // the UNIQUE(source, event_id) and we ack 200 without re-ingesting.
    const dedup = await recordIncoming(spec.source, env2.eventId, parsed.data);
    if (!dedup.inserted || !dedup.webhookEventId) {
      return NextResponse.json({ ok: true, duplicate: true });
    }
    const webhookEventId = dedup.webhookEventId;

    const receivedAt = new Date();
    try {
      const outcome = await spec.handler({
        parsed: parsed.data as zInfer<S>,
        rawBody: body,
        receivedAt,
        source: spec.source,
        eventId: env2.eventId,
        companyId: env.WEBHOOK_COMPANY_ID ?? null,
      });
      if (!outcome.ok) {
        await stampOutcome(webhookEventId, 'failed', outcome.reason);
        return NextResponse.json({ error: 'handler_failed' }, { status: 500 });
      }
      await stampOutcome(webhookEventId, 'success');
      return NextResponse.json({ ok: true });
    } catch (err) {
      await stampOutcome(
        webhookEventId,
        'failed',
        err instanceof Error ? err.message.slice(0, 500) : 'unknown',
      );
      return NextResponse.json({ error: 'handler_exception' }, { status: 500 });
    }
  };
}
