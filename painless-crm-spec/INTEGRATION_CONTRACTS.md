# Integration Contracts

**Status:** canonical
**Last updated:** spec v2

This document defines the contract for each external integration: what we send, what we receive, error handling expectations, refresh/rotation cadence, and credentials format. The shared webhook handler (`references/webhook-pattern.md`) and the credentials table (`integration_credentials`) are platform — this document is per-provider.

When a phase doc says "send to Xero" or "receive GoCardless webhook", it references this file rather than restating the contract.

---

## 1. Painlessremovals.com → CRM (inbound webhooks)

**Purpose:** The painlessremovals.com calculator and contact forms generate leads, quotes, callback requests, etc. Each event is sent to the CRM as a webhook.

**Direction:** painlessremovals → CRM
**Auth:** HMAC-SHA256 over `{timestamp}.{schema_version}.{raw_body}` with shared secret `WEBHOOK_SECRET_PAINLESSREMOVALS`
**Endpoints (CRM side):**
- `POST /api/webhooks/painlessremovals/quote` — calculator quote saved
- `POST /api/webhooks/painlessremovals/contact` — contact form submission
- `POST /api/webhooks/painlessremovals/callback` — callback request
- `POST /api/webhooks/painlessremovals/affiliate-lead` — affiliate-attributed lead
- `POST /api/webhooks/painlessremovals/clearance-callback` — clearance service callback
- `POST /api/webhooks/painlessremovals/partner-register` — partner registration

**Headers:**
- `X-Signature: hmac-sha256={hex}` — required
- `X-Timestamp: {unix_seconds}` — required, must be within 300s of server time
- `X-Schema-Version: 1.0` — required, allow-listed
- `X-Event-Id: {uuid}` — required, used for idempotency
- `Content-Type: application/json`

**Payload schema:**

```typescript
// Common envelope
interface PainlessremovalsEvent {
  event_id: string;          // matches X-Event-Id header
  event_type: 'quote_saved' | 'contact_submitted' | 'callback_requested' | ...;
  occurred_at: string;       // ISO timestamp
  source_url: string;        // page URL that generated the event
  utm: {
    source?: string;
    medium?: string;
    campaign?: string;
    term?: string;
    content?: string;
  };
  fbp?: string;              // Meta browser ID
  fbc?: string;              // Meta click ID
  gclid?: string;            // Google click ID
  user_agent: string;
  ip: string;                // X-Forwarded-For from CF
  payload: any;              // event-specific (validated by per-endpoint Zod schema)
}
```

Per-endpoint schemas live in `lib/webhooks/sources/painlessremovals/schemas.ts` (Phase 5).

**Response contract:**
- `200 OK { ok: true, event_id, job_id?: string }` — event accepted (or duplicate)
- `400 Bad Request { error }` — schema validation failed
- `401 Unauthorized { error }` — signature/timestamp/version failed
- `429 Too Many Requests` — rate limit
- `5xx` — server error, sender should retry with exponential backoff

**Retry:** painlessremovals retries 3 times with 1s, 5s, 30s backoff on 5xx. After that the event is logged client-side as failed and surfaced in painlessremovals admin (Phase 5).

**Idempotency:** every event has a `X-Event-Id`. Duplicate events return 200 with `{ duplicate: true }`. The CRM does not double-process.

---

## 2. CRM → Cloudflare KV (pricing + availability broadcast)

**Purpose:** CRM is master of pricing config and capacity calendar. Calculator reads from KV at edge for sub-millisecond response.

**Direction:** CRM → KV (write), painlessremovals → KV (read)
**Auth:** Cloudflare Workers binding (no HTTP)
**Keys:**
- `pricing:current` — full active pricing config (broadcast-safe portion only)
- `pricing:history:{version_id}` — point-in-time snapshots, retained 12 months
- `availability:{YYYY-WW}` — week capacity bands (green/yellow/red) for a given ISO week
- `availability:current-month` — convenience aggregate for the current month

**Write trigger:** Phase 5 — when an admin publishes a new pricing version. Phase 7 — when capacity overrides change or daily utilization view recomputes.

**Read pattern (calculator side):**
```typescript
const pricing = await env.PRICING_KV.get('pricing:current', 'json');
if (!pricing) {
  // Build-time fallback bundled in calculator repo
  return BUILTIN_PRICING_FALLBACK;
}
```

**Failure modes:**
- KV write failure on CRM publish → admin sees error, prompted to retry
- KV read failure on calculator → falls back to bundled config (slightly stale)
- Stale KV after CRM publish → eventual consistency, max ~30 seconds globally

**Quote freeze guarantee:** Quotes never read KV at acceptance time. They store `pricing_version_id` and read the snapshot from the database. KV changes do not retroactively affect issued quotes.

---

## 3. Xero (accounting sync)

**Purpose:** Sync invoices, payments, customers between CRM and Xero. Painless's books are in Xero — CRM does not duplicate accounting truth, it mirrors it.

**Direction:** CRM ⇄ Xero (bidirectional)
**Auth:** OAuth 2.0
**Credentials storage:** `integration_credentials` table, `provider = 'xero'`
**Token lifecycle:**
- Access token: 30 minutes
- Refresh token: 60 days (rotates on each refresh, must update encrypted row)
- If a refresh token expires, admin must reconnect via UI

**Refresh strategy:** Cron-triggered refresh every 25 minutes. Background job fetches all `integration_credentials WHERE provider = 'xero' AND status = 'active' AND expires_at < now() + interval '5 minutes'`. On failure, increments `refresh_failure_count`; after 3 consecutive failures, marks `status = 'expired'` and notifies admin.

**Endpoints used:**
- `POST /api.xro/2.0/Contacts` — upsert customer
- `POST /api.xro/2.0/Invoices` — create invoice (deposit, custom, final)
- `POST /api.xro/2.0/Payments` — record payment
- `POST /api.xro/2.0/CreditNotes` — refund / adjustment
- `GET /api.xro/2.0/Invoices?Statuses=PAID&modifiedAfter={ts}` — pull paid invoices for status sync

**Idempotency:** Every CRM-originated Xero call uses a deterministic `Idempotency-Key` header derived from CRM entity ID. E.g., `crm-invoice-{invoice_id}`. Re-running the same call is safe.

**Webhooks (Xero → CRM):**
- Xero supports webhooks for `Invoice` and `Contact` events.
- Endpoint: `POST /api/webhooks/xero`
- Auth: HMAC-SHA256 with `WEBHOOK_SECRET_XERO` (Xero-issued)
- Schema version: `1.0` (Xero's "intent" payload, not their full object — we then call back to fetch the object)

**Error handling:**
- 401 on Xero call → mark credentials expired, push admin notification
- 429 on Xero call → respect `Retry-After` header, queue retry
- 5xx → exponential backoff (1m, 5m, 30m, 2h, 12h), then mark failed and alert
- Validation errors (400) → log to `activity_log`, do not retry, surface in UI

**Rate limits:** Xero allows 60 requests/minute per tenant. We aggregate batch operations where possible.

---

## 4. GoCardless (Direct Debit)

**Purpose:** Recurring storage rental billing via UK Direct Debit.

**Direction:** CRM ⇄ GoCardless
**Auth:** OAuth 2.0 + access token
**Credentials storage:** `integration_credentials` table, `provider = 'gocardless'`
**Token lifecycle:** GoCardless tokens are long-lived (12 months) but should be rotated every 6 months as best practice.

**Mandate setup flow:**
1. CRM creates customer in GoCardless (POST /customers)
2. CRM creates redirect flow (POST /redirect_flows) with success URL = CRM redirect handler
3. Customer authorizes mandate on GoCardless-hosted page
4. GoCardless redirects to CRM, CRM completes flow (POST /redirect_flows/{id}/actions/complete)
5. CRM stores `gocardless_mandate_id` in `direct_debit_mandates`
6. Webhook event `mandates: created` confirms

**Recurring payment flow:**
1. Cron job (1st of month) creates payment objects for each active storage rental (POST /payments)
2. GoCardless processes 3 working days later
3. Webhook `payments: paid_out` confirms success → `payment_allocations` row created
4. Webhook `payments: failed` triggers dunning flow

**Webhooks (GoCardless → CRM):**
- Endpoint: `POST /api/webhooks/gocardless`
- Auth: HMAC-SHA256 with `WEBHOOK_SECRET_GOCARDLESS` (GoCardless-issued, called Webhook Secret)
- Events: `mandates: created/cancelled/failed/expired`, `payments: created/paid_out/failed/charged_back`, `customers: updated`
- IP allowlist: GoCardless publishes IPs at https://gocardless.com/faq/security/

**Sandbox vs Live:** GoCardless has separate sandbox API base URL. Phase 12 Phase 0 task: provision sandbox credentials, run end-to-end mandate flow before live.

---

## 5. Google Ads (offline conversions)

**Purpose:** Send "won" job events back to Google Ads as Enhanced Conversions for Leads, attributing the conversion to the original ad click.

**Direction:** CRM → Google Ads (one-way)
**Auth:** OAuth 2.0 + Developer Token + login_customer_id
**Credentials storage:** `integration_credentials` table, `provider = 'google_ads'`
**Token lifecycle:** OAuth access token 1 hour, refresh token long-lived (until revoked). Refresh on demand (lazy) before each call rather than scheduled.

**Trigger:** When a job stage transitions to `paid`, the automation engine queues an offline conversion upload (Phase 14). Stored in `offline_conversion_uploads` until uploaded.

**Endpoint:** Google Ads API `customers:uploadOfflineUserData` with `OfflineUserDataJobOperation` of type `STORE_SALES_UPLOAD_FIRST_PARTY` (or `ENHANCED_CONVERSIONS_FOR_LEADS` depending on conversion source).

**Hashing:** Google requires SHA-256 of normalized email and phone. Normalization rules: lowercase email, strip whitespace; phone in E.164.

**Failure handling:** Mark `offline_conversion_uploads.status = 'failed'` with error message. Manual retry from Phase 14 admin UI.

---

## 6. Meta Ads (CAPI offline conversions)

**Purpose:** Same as Google Ads but for Meta Conversions API. Send "won" events back to Meta with hashed customer data + click ID for attribution.

**Direction:** CRM → Meta (one-way)
**Auth:** Long-lived system user access token
**Credentials storage:** `integration_credentials` table, `provider = 'meta_ads'`
**Token lifecycle:** System user tokens don't expire by default but should be rotated every 90 days.

**Trigger:** Same as Google Ads — `paid` stage entry.

**Endpoint:** `POST https://graph.facebook.com/v18.0/{pixel_id}/events`

**Payload:**
```json
{
  "data": [{
    "event_name": "Purchase",
    "event_time": 1700000000,
    "event_id": "{job_id}-paid",
    "action_source": "system_generated",
    "user_data": {
      "em": ["{sha256(email)}"],
      "ph": ["{sha256(phone)}"],
      "fbc": "{stored fbc}",
      "fbp": "{stored fbp}",
      "client_ip_address": "{stored ip}",
      "client_user_agent": "{stored UA}"
    },
    "custom_data": {
      "currency": "GBP",
      "value": "{job_total}",
      "content_name": "{job_type}"
    }
  }],
  "access_token": "{token}"
}
```

**Deduplication with browser pixel:** Same `event_id` is used in painlessremovals.com browser pixel and CRM CAPI. Meta deduplicates server + browser events by `event_id`. The CRM-side `event_id` is `{job_id}-{stage}` — deterministic.

---

## 7. Meta WhatsApp Business API

**Purpose:** Send templated messages to customers (quote ready, confirmation, follow-up) and receive replies.

**Direction:** CRM ⇄ Meta WhatsApp Cloud API
**Auth:** System user access token (same pattern as Meta Ads but with WhatsApp permissions)
**Credentials storage:** `integration_credentials` table, `provider = 'meta_whatsapp'`

**Template approval:** All outbound templates must be pre-approved by Meta (1–2 week review). Templates stored in `whatsapp_templates` table with their Meta template name + language + variable placeholders.

**Outbound endpoint:** `POST https://graph.facebook.com/v18.0/{phone_number_id}/messages`

**Inbound webhooks:** `POST /api/webhooks/meta-whatsapp` for replies. Auth via Meta's webhook signature (HMAC-SHA1 with App Secret — note SHA1 is what Meta uses, not SHA256).

**Phone number verification:** Painless's WhatsApp Business phone number must be verified by Meta. Setup is one-time and out-of-band (not automated).

**Pricing:** Meta charges per conversation. UK service conversations are ~£0.04. Painless covers cost — pass-through accounted for in margin.

---

## 8. Resend (transactional email)

**Purpose:** All transactional email — quotes, confirmations, invoices, follow-ups, password resets.

**Direction:** CRM → Resend (send), Resend → CRM (delivery webhooks)
**Auth:** API key in env var `RESEND_API_KEY`. Note: not in `integration_credentials` because keys are simple, not OAuth, and rotate via Resend dashboard.
**Send endpoint:** Resend SDK / REST API. Phase 13 wraps it in `lib/email/send.ts`.

**Webhooks:** `POST /api/webhooks/resend`
- Auth: HMAC-SHA256 with `WEBHOOK_SECRET_RESEND`
- Events: `email.sent`, `email.delivered`, `email.opened`, `email.clicked`, `email.bounced`, `email.complained`
- Used for: open tracking on quote/invoice emails, bounce handling

**Bounce handling:** On `email.bounced`, mark `customers.email_status = 'bounced'`. Sales rep gets notified to update the email address.

---

## 9. Tamar Telecom (call tracking)

**Status:** OD-1 (open decision) — Partner API access not confirmed
**Purpose:** Track inbound calls to Painless's tracking numbers, attribute to ad campaigns, log call duration.

**MVP path (no API access):**
- Tamar emails call notifications to a designated address
- Resend Inbound or Cloudflare Email Workers parse the email
- Webhook `POST /api/webhooks/tamar-email` ingests parsed data → `phone_calls` table

**Future path (Partner API approved):**
- OAuth via `integration_credentials` provider `tamar_telecom`
- Webhook for real-time call events
- API for retrospective call logs

The MVP path is in v0.3 (Phase 13). The future path is post-v1 once Tamar approves Partner API access.

---

## 10. Liveswitch (video survey)

**Status:** OD-3 (open decision) — v0.2 scope: upload-only or full SDK
**Purpose:** Customer self-record video surveys for cubic estimation.

**MVP path (upload-only, default):**
- Customer receives a survey link
- Page uses Liveswitch SDK for client-side recording
- On stop, video uploads to Liveswitch storage
- Webhook `POST /api/webhooks/liveswitch` notifies CRM with video URL
- CRM stores reference in `surveys.video_url`

**Future path (live calls, post-v1):**
- Surveyor and customer connect via Liveswitch live SDK
- Surveyor performs walk-through with customer in real time
- Recording stored, processed offline by AI for cubic estimation

Auth: Liveswitch application key + secret. Stored in env vars (not `integration_credentials`).

---

## 11. Anthropic API (Claude Haiku for duplicate detection + scoring)

**Purpose:** AI-powered fuzzy duplicate detection on inbound leads, lead-quality signals.

**Direction:** CRM → Anthropic
**Auth:** API key `ANTHROPIC_API_KEY` in Cloudflare Workers secret
**Endpoint:** `POST https://api.anthropic.com/v1/messages`
**Model:** `claude-haiku-4-5-20251001` (current as of v2 spec; update via env var `ANTHROPIC_MODEL` so we don't redeploy for model changes)

**Cost budget:** ~£0.001 per duplicate check. Rate-limited to 100 checks/hour per tenant to prevent runaway. Total expected v0.1 usage: ~£15/year for Painless's volume.

**Failure handling:** If Anthropic returns 5xx or times out (>3s), the lead create proceeds without duplicate detection. AI is enrichment, not gating.

---

## Summary table

| Provider | Type | Direction | Auth | Credentials location | v0.x |
|----------|------|-----------|------|----------------------|------|
| painlessremovals | inbound webhook | → CRM | HMAC | env: `WEBHOOK_SECRET_PAINLESSREMOVALS` | v0.1 |
| Cloudflare KV | edge cache | CRM → KV ↔ calculator | Workers binding | (no creds) | v0.1 |
| Xero | accounting | CRM ⇄ Xero | OAuth 2.0 | `integration_credentials` | v0.2 |
| GoCardless | direct debit | CRM ⇄ GoCardless | OAuth 2.0 | `integration_credentials` | v0.3 |
| Google Ads | offline conversions | CRM → Google | OAuth 2.0 | `integration_credentials` | v0.3 |
| Meta Ads | offline conversions | CRM → Meta | system user token | `integration_credentials` | v0.3 |
| Meta WhatsApp | messaging | CRM ⇄ Meta | system user token | `integration_credentials` | v0.3 |
| Resend | email | CRM ⇄ Resend | API key | env: `RESEND_API_KEY` | v0.1 |
| Tamar Telecom | call tracking | Tamar → CRM | email parsing or OAuth | env or `integration_credentials` | v0.3 (OD-1) |
| Liveswitch | video survey | CRM ⇄ Liveswitch | API key | env: `LIVESWITCH_KEY` | v0.2 (OD-3) |
| Anthropic API | AI | CRM → Anthropic | API key | env: `ANTHROPIC_API_KEY` | v0.1 |
