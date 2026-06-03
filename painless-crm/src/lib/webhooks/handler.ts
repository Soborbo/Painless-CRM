// Inbound webhook handler v2 — the only sanctioned entry point for inbound
// webhooks per CLAUDE.md rule 14. Do not bypass with bespoke handlers.
//
// Responsibilities, in order:
//   1. Reject if HMAC signature missing or invalid (constant-time compare)
//   2. Parse JSON; reject malformed payloads with 400
//   3. Dedup via webhook_events (UNIQUE on (source, event_id))
//   4. Validate payload with the route's Zod schema
//   5. Run the route handler with the parsed payload
//   6. Stamp webhook_events with success | duplicate | failed
//
// Persisted error envelopes are intentionally vague to keep PII out of logs;
// detailed errors stream to Sentry via the route handler's own try/catch.

import { serverEnv } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import type { ZodTypeAny, infer as zInfer } from 'zod';

export interface WebhookHandlerArgs<T> {
  parsed: T;
  rawBody: string;
  receivedAt: Date;
  source: string;
  eventId: string;
  /**
   * Server-resolved tenant for this webhook (env WEBHOOK_COMPANY_ID), or null
   * when unconfigured. Ingest handlers MUST prefer this over any body-supplied
   * company_id so a forged payload cannot target another tenant (audit H2).
   */
  companyId: string | null;
}

export type WebhookOutcome = { ok: true } | { ok: false; reason: string };

export interface WebhookRouteSpec<S extends ZodTypeAny> {
  source: string;
  schema: S;
  eventIdPath: (payload: zInfer<S>) => string;
  handler: (args: WebhookHandlerArgs<zInfer<S>>) => Promise<WebhookOutcome>;
}

const HMAC_HEADER = 'x-webhook-signature';
const TIMESTAMP_HEADER = 'x-webhook-timestamp';
const VERSION_HEADER = 'x-webhook-version';

// SECURITY_MODEL §4 gate 2 — replay protection. A captured request is only
// valid for a short window even with a correct signature.
const TIMESTAMP_TOLERANCE_SECONDS = 300;
// SECURITY_MODEL §4 gate 3 — schema-version pinning. Each accepted version is
// enumerated so a future breaking change can be enforced cryptographically.
const SUPPORTED_WEBHOOK_VERSIONS = ['1', '1.0'];

export function isFreshTimestamp(tsHeader: string | null, nowMs: number): boolean {
  if (!tsHeader) return false;
  const ts = Number.parseInt(tsHeader, 10);
  if (!Number.isFinite(ts)) return false;
  return Math.abs(nowMs / 1000 - ts) <= TIMESTAMP_TOLERANCE_SECONDS;
}

export function isSupportedWebhookVersion(version: string | null): boolean {
  return version !== null && SUPPORTED_WEBHOOK_VERSIONS.includes(version);
}

// SECURITY_MODEL §4 gate 1 — the HMAC is computed over the canonical
// {timestamp}.{schema_version}.{raw_body} so the timestamp and version are
// cryptographically bound (not just compared as plaintext headers).
export function canonicalSignaturePayload(
  timestamp: string,
  version: string,
  rawBody: string,
): string {
  return `${timestamp}.${version}.${rawBody}`;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

async function computeHmacSha256Hex(secret: string, body: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(body));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function verifyHmac(
  secret: string,
  body: string,
  header: string | null,
): Promise<boolean> {
  if (!header) return false;
  const provided = header.startsWith('sha256=') ? header.slice(7) : header;
  const expected = await computeHmacSha256Hex(secret, body);
  return timingSafeEqual(provided.toLowerCase(), expected.toLowerCase());
}

interface DedupResult {
  inserted: boolean;
  webhookEventId?: string;
}

async function recordIncoming(
  source: string,
  eventId: string,
  eventType: string,
  payload: unknown,
): Promise<DedupResult> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('webhook_events')
    .insert({ source, event_id: eventId, event_type: eventType, payload })
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

export function createWebhookHandler<S extends ZodTypeAny>(spec: WebhookRouteSpec<S>) {
  return async function POST(req: Request): Promise<Response> {
    const env = serverEnv();
    const secret = env.CRM_WEBHOOK_SECRET;
    if (!secret) {
      return NextResponse.json({ error: 'webhook_disabled' }, { status: 503 });
    }
    const body = await req.text();

    // Gate 3 — schema-version pinning.
    const version = req.headers.get(VERSION_HEADER);
    if (!isSupportedWebhookVersion(version)) {
      return NextResponse.json({ error: 'unsupported_schema_version' }, { status: 400 });
    }
    // Gate 2 — timestamp freshness (replay protection).
    const timestamp = req.headers.get(TIMESTAMP_HEADER);
    if (!isFreshTimestamp(timestamp, Date.now())) {
      return NextResponse.json({ error: 'stale_timestamp' }, { status: 401 });
    }
    // Gate 1 — HMAC over the canonical {timestamp}.{version}.{raw_body}. version
    // and timestamp are non-null here (gates above), so the cast is safe.
    const canonical = canonicalSignaturePayload(timestamp as string, version as string, body);
    const valid = await verifyHmac(secret, canonical, req.headers.get(HMAC_HEADER));
    if (!valid) {
      return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });
    }

    let json: unknown;
    try {
      json = JSON.parse(body);
    } catch {
      return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
    }

    const parsed = spec.schema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
    }

    const eventId = spec.eventIdPath(parsed.data as zInfer<S>);
    const dedup = await recordIncoming(spec.source, eventId, spec.source, parsed.data);
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
        eventId,
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
