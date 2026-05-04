# Webhook Pattern v2 (Inbound)

**Status:** canonical (replaces v1)
**Last updated:** spec v2
**Related:** `SECURITY_MODEL.md` §4, `INTEGRATION_CONTRACTS.md`, `DECISIONS.md` ADR-014

This document defines the canonical inbound webhook handler. **All** inbound webhooks (painlessremovals, GoCardless, Xero, Resend, Meta, etc.) go through this pattern. Per-source customizations are isolated in source-specific modules.

## Why a single hardened pattern

Every webhook handler in the wild reinvents these gates. Each reinvention introduces subtle bugs (signature comparison via `==` instead of timing-safe; replay vulnerability via missing timestamp; idempotency via filename instead of unique constraint). One shell, audited once, reused everywhere.

---

## The five gates

Every inbound request must pass all five in order. Failure at any gate returns a documented status code; downstream gates are not evaluated.

1. **Signature verification** — HMAC-SHA256 over `{timestamp}.{schema_version}.{raw_body}`
2. **Timestamp freshness** — 5-minute window, anti-replay
3. **Schema version pinning** — allow-list per source, future-proof
4. **Idempotency** — `webhook_events` unique constraint claims the event
5. **Rate limiting** — per-source per-IP, 60-second window

A sixth optional gate is **IP allowlist** for sources that publish their IP ranges (GoCardless, Meta).

---

## The shared shell

```ts
// src/lib/webhooks/handler.ts

import { NextRequest, NextResponse } from 'next/server';
import { z, ZodSchema } from 'zod';
import { getAdminClient } from '@/lib/supabase/admin';
import { rateLimitCheck } from '@/lib/rate-limit';
import { scrubPII } from '@/lib/logger';
import * as Sentry from '@sentry/nextjs';
import { timingSafeEqual, createHmac } from 'crypto';

interface WebhookHandlerOptions<T> {
  source: string;
  supportedSchemaVersions: string[];
  getSecret: () => Promise<string> | string;
  schema: ZodSchema<T>;
  extractEventId: (payload: T) => string;
  process: (
    payload: T,
    ctx: { admin: ReturnType<typeof getAdminClient>; eventId: string }
  ) => Promise<{ ok: true; data?: any } | { ok: false; reason: string }>;
  rateLimit?: { windowSec: number; maxRequests: number };
  ipAllowlist?: string[];
}

export function createWebhookHandler<T>(opts: WebhookHandlerOptions<T>) {
  const rateLimit = opts.rateLimit ?? { windowSec: 60, maxRequests: 120 };

  return async (req: NextRequest) => {
    const startedAt = Date.now();
    const ip = req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for') ?? 'unknown';

    let rawBody: string;
    try {
      rawBody = await req.text();
    } catch {
      return reject(opts.source, 'malformed_body', 400);
    }

    // Optional Gate 0: IP allowlist
    if (opts.ipAllowlist && !ipMatchesAllowlist(ip, opts.ipAllowlist)) {
      return reject(opts.source, 'ip_not_allowlisted', 403, { ip });
    }

    // Gate 1: Signature verification (over canonical: timestamp.version.body)
    const sigHeader = req.headers.get('x-signature') ?? '';
    const timestampHeader = req.headers.get('x-timestamp') ?? '';
    const versionHeader = req.headers.get('x-schema-version') ?? '';

    if (!sigHeader || !timestampHeader || !versionHeader) {
      return reject(opts.source, 'missing_required_headers', 400);
    }

    const canonical = `${timestampHeader}.${versionHeader}.${rawBody}`;
    const secret = await opts.getSecret();
    const expected = createHmac('sha256', secret).update(canonical).digest('hex');
    const received = sigHeader.replace(/^hmac-sha256=/, '');

    let sigValid = false;
    try {
      const expectedBuf = Buffer.from(expected, 'hex');
      const receivedBuf = Buffer.from(received, 'hex');
      sigValid = expectedBuf.length === receivedBuf.length
        && timingSafeEqual(expectedBuf, receivedBuf);
    } catch {
      sigValid = false;
    }

    if (!sigValid) {
      return reject(opts.source, 'invalid_signature', 401);
    }

    // Gate 2: Timestamp freshness (5-min window, anti-replay)
    const ts = parseInt(timestampHeader, 10);
    const now = Math.floor(Date.now() / 1000);
    if (!Number.isFinite(ts) || Math.abs(now - ts) > 300) {
      return reject(opts.source, 'stale_timestamp', 401, { ts, now, drift: now - ts });
    }

    // Gate 3: Schema version pinning
    if (!opts.supportedSchemaVersions.includes(versionHeader)) {
      return reject(opts.source, 'unsupported_schema_version', 400, {
        received: versionHeader,
        supported: opts.supportedSchemaVersions,
      });
    }

    // Gate 4: Schema validation (separate from version pinning)
    let payload: T;
    try {
      const parsed = JSON.parse(rawBody);
      payload = opts.schema.parse(parsed);
    } catch (err: any) {
      return reject(opts.source, 'invalid_payload', 400, { issues: err?.issues ?? err?.message });
    }

    const eventId = opts.extractEventId(payload);
    if (!eventId) {
      return reject(opts.source, 'missing_event_id', 400);
    }

    // Gate 5: Rate limit
    const rlOk = await rateLimitCheck(`webhook:${opts.source}:${ip}`, rateLimit);
    if (!rlOk) {
      return reject(opts.source, 'rate_limited', 429);
    }

    // Idempotency: try-insert into webhook_events. Unique constraint claims the event.
    const admin = getAdminClient();
    const { data: claim, error: claimErr } = await admin
      .from('webhook_events')
      .insert({
        source: opts.source,
        event_id: eventId,
        event_type: (payload as any).event_type ?? 'unknown',
        payload: payload as any,
        received_at: new Date().toISOString(),
      })
      .select('id')
      .maybeSingle();

    if (claimErr && (claimErr as any).code === '23505') {
      // Unique violation = duplicate, idempotent success
      return NextResponse.json({ ok: true, duplicate: true, event_id: eventId });
    }

    if (claimErr || !claim) {
      Sentry.captureException(claimErr ?? new Error('webhook_claim_failed'), {
        tags: { source: opts.source, event_id: eventId },
      });
      return NextResponse.json({ error: 'storage_failed' }, { status: 500 });
    }

    // Process
    let result: { ok: true; data?: any } | { ok: false; reason: string };
    try {
      result = await opts.process(payload, { admin, eventId });
    } catch (err: any) {
      Sentry.captureException(err, {
        tags: { source: opts.source, event_id: eventId },
        contexts: { webhook: { duration_ms: Date.now() - startedAt } },
      });
      await admin
        .from('webhook_events')
        .update({
          processed_at: new Date().toISOString(),
          result: 'failed',
          error_message: scrubPII(String(err?.message ?? err)).slice(0, 500),
        })
        .eq('id', claim.id);
      return NextResponse.json({ error: 'processing_failed' }, { status: 500 });
    }

    await admin
      .from('webhook_events')
      .update({
        processed_at: new Date().toISOString(),
        result: result.ok ? 'success' : 'failed',
        error_message: result.ok ? null : result.reason,
      })
      .eq('id', claim.id);

    if (!result.ok) {
      return NextResponse.json({ error: result.reason }, { status: 422 });
    }

    return NextResponse.json({ ok: true, event_id: eventId, ...(result.data ?? {}) });
  };
}

function reject(
  source: string,
  reason: string,
  status: number,
  context?: Record<string, any>
) {
  Sentry.addBreadcrumb({
    category: 'webhook',
    message: `${source}: ${reason}`,
    level: 'warning',
    data: context,
  });
  return NextResponse.json({ error: reason }, { status });
}

function ipMatchesAllowlist(ip: string, allowlist: string[]): boolean {
  for (const entry of allowlist) {
    if (entry === ip) return true;
    if (entry.includes('/') && cidrContains(entry, ip)) return true;
  }
  return false;
}

declare function cidrContains(cidr: string, ip: string): boolean;
```

---

## Per-source usage

```ts
// src/app/api/webhooks/painlessremovals/quote/route.ts

import { createWebhookHandler } from '@/lib/webhooks/handler';
import { quoteSavedSchema } from '@/lib/webhooks/sources/painlessremovals/schemas';
import { processPainlessremovalsQuote } from '@/lib/webhooks/sources/painlessremovals/process';

export const POST = createWebhookHandler({
  source: 'painlessremovals',
  supportedSchemaVersions: ['1.0', '1.1'],
  getSecret: () => process.env.WEBHOOK_SECRET_PAINLESSREMOVALS!,
  schema: quoteSavedSchema,
  extractEventId: (p) => p.event_id,
  process: processPainlessremovalsQuote,
  rateLimit: { windowSec: 60, maxRequests: 60 },
});
```

For sources with secret rotation in flight, the handler's `getSecret` returns the primary; v2.1 of the handler (in Phase 13) will accept overlap arrays for rotation windows.

---

## Sender-side helper (for the painlessremovals.com side)

```ts
// painlessremovals/src/lib/webhooks/send.ts

import { createHmac, randomUUID } from 'crypto';

export async function sendCRMWebhook<T>(
  endpoint: string,
  schemaVersion: string,
  eventType: string,
  payload: T
) {
  const secret = process.env.CRM_WEBHOOK_SECRET!;
  const eventId = randomUUID();
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const body = JSON.stringify({
    event_id: eventId,
    event_type: eventType,
    occurred_at: new Date().toISOString(),
    ...payload,
  });

  const canonical = `${timestamp}.${schemaVersion}.${body}`;
  const signature = createHmac('sha256', secret).update(canonical).digest('hex');

  const res = await fetch(`${process.env.CRM_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Signature': `hmac-sha256=${signature}`,
      'X-Timestamp': timestamp,
      'X-Schema-Version': schemaVersion,
      'X-Event-Id': eventId,
    },
    body,
  });

  if (!res.ok && res.status >= 500) {
    throw new RetryableWebhookError(`CRM webhook failed ${res.status}`);
  }
  return res.json();
}
```

Sender retries 3× with 1s, 5s, 30s backoff on 5xx. On 4xx (except 429), the request is permanently rejected and logged.

---

## Idempotency contract

A given `(source, event_id)` is processed at most once. Senders use a stable `event_id` per logical event:

- painlessremovals quote save: `event_id = quote_uuid` (assigned at save)
- GoCardless mandate created: `event_id = gocardless_event_id`
- Xero invoice updated: `event_id = "{tenant_id}-{invoice_id}-{ETag}"`

Re-sending with the same `event_id` returns 200 `{ duplicate: true }` without invoking process.

---

## Error response codes

| Code | Reason | Sender action |
|------|--------|---------------|
| 200 | Success or duplicate | Done |
| 400 | malformed_body, missing_required_headers, unsupported_schema_version, invalid_payload, missing_event_id | Fix request; do not retry |
| 401 | invalid_signature, stale_timestamp | Fix auth; do not retry |
| 403 | ip_not_allowlisted | Out of band |
| 422 | processing failed (business logic) | Investigate, retry after fix |
| 429 | rate_limited | Wait, retry with backoff |
| 500 | storage_failed, processing_failed (system-level) | Retry with exponential backoff |

---

## Testing

`tests/webhooks/handler.test.ts` covers all five gates plus edge cases. Each per-source webhook has its own test file exercising the source schema + process function.

Test cases (mandatory):
- Valid request → 200
- Bad signature → 401
- Stale timestamp (>5 min) → 401
- Future timestamp (>5 min) → 401
- Missing required header → 400
- Unsupported schema version → 400
- Bad JSON body → 400
- Schema validation failure → 400
- Missing event_id → 400
- Duplicate event_id → 200 with `duplicate: true`
- Rate-limit overflow → 429
- IP allowlist violation (where configured) → 403
- Process throws → 500 with audit trail
- Process returns `{ ok: false }` → 422 with audit trail

---

## Migration note from v1

If any v1 webhook ever shipped (it didn't — v0.1 ships with v2 from day one), the migration would be:

1. Update sender to include `X-Timestamp` + `X-Schema-Version` headers
2. Update sender HMAC to use `{timestamp}.{version}.{body}` canonical
3. Run both forms briefly via feature flag
4. Cut over

For v0.1 this is moot — v2 is the only form.
