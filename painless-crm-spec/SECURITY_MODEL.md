# Security Model

**Status:** canonical
**Last updated:** spec v2

This document defines the security posture for painless-crm. It covers the threat model, the multi-tenant isolation contract, webhook hardening, secret management, and the PII handling rules. Other docs reference this one — they don't restate it.

---

## 1. Threat model (informal)

We design defensively against these realistic threat actors:

### T1 — Malicious cross-tenant access (post-launch SaaS)
Once we onboard a second tenant (v0.2+), a paying customer of tenant B should never see tenant A data, even if they craft URLs, manipulate request parameters, or replay other tenants' API calls. **Mitigation:** RLS on every table with `current_user_company_id()`, plus a CI test that asserts cross-tenant queries return zero rows (Phase 01).

### T2 — Webhook forgery and replay
An attacker who learns the structure of our calculator → CRM webhook (or who captures one valid request) tries to inject fake leads or replay old payloads. **Mitigation:** HMAC + timestamp + version + idempotency key + per-source secret rotation. See §4 below.

### T3 — Credential theft
An attacker gains read access to the database (e.g., via a Supabase service role key leak, an SQL injection, or a backup leak) and tries to use Xero / GoCardless / Meta tokens to impersonate the company. **Mitigation:** Tokens encrypted at rest with `pgcrypto`, encryption key in env vars (not in DB), access logged to `integration_credential_access_log`, refresh failure alerting.

### T4 — Insider data exfiltration
A sales rep with legitimate CRM access tries to bulk-export the customer list before leaving for a competitor. **Mitigation:** Bulk read operations rate-limited, large export operations audit-logged with row counts, admin can revoke sessions immediately. (Note: full DLP is post-v1.)

### T5 — PII leak via error tracking
A bug causes Sentry to capture customer name, address, or contact details in a stack trace or breadcrumb, which Anthropic / Sentry / cloud logs persist. **Mitigation:** Strict `beforeSend` hook in Sentry config, PII allow-list (postcode districts only, never full postcodes; never names; never phones; never emails). See §6 below.

### T6 — Worker PWA token theft
A worker's phone is stolen with the PWA still authenticated. **Mitigation:** Short worker session length (7 days vs 30 days office), session immediately revocable from admin UI, optional PIN lock on PWA (post-v1).

### T7 — Public quote page abuse
The customer-facing quote acceptance page must be reachable without login (it's emailed to customers). An attacker who guesses or scrapes URLs tries to view other customers' quotes. **Mitigation:** Tokens are 256-bit random, expire, single-use for acceptance (multi-use for view). No incremental IDs in URLs.

### T8 — Pricing data leak via KV
The Cloudflare KV `pricing:current` and `availability:*` keys are public-readable to the calculator. We accept this — pricing rules are not a trade secret in this market. **Mitigation:** Only put broadcast-safe data in KV. Margin matrix is OK to expose (competitors can already reverse-engineer it). Customer data, internal cost figures, and worker identity must never go to KV.

### Out of scope (acknowledged)

- Full DDoS protection (delegated to Cloudflare)
- Hardware key (FIDO2) enforcement (post-v1)
- Hardware-isolated key management (HSM) for `pgcrypto` keys (post-v2)
- HIPAA / PCI-DSS compliance (not required for UK removals)

---

## 2. Multi-tenant isolation contract

This is the most important security property. Every claim below is enforced by code, tested in CI, and audited by RLS.

**Claim 1.** Every row in every business table belongs to exactly one tenant via `company_id UUID NOT NULL`.
**Enforcement:** schema-level NOT NULL, no defaults that would allow nulls.
**Test:** `tests/schema/no-null-company-id.test.ts` — runs `SELECT count(*) FROM <each table> WHERE company_id IS NULL` against a populated test DB; must return 0 for all.

**Claim 2.** Every authenticated request has exactly one resolvable `company_id` via `current_user_company_id()`.
**Enforcement:** SQL function returns `users.company_id` for the authenticated user. If user has multiple companies (super_admin scenario), function uses session-set GUC `app.current_company_id`.
**Test:** `tests/auth/resolves-company-id.test.ts` — every fixture user resolves correctly.

**Claim 3.** Every business table has a `tenant_isolation` RLS policy.
**Enforcement:** Migration 01_rls.sql attaches policies; Phase 01 test enumerates all `pg_class` tables and asserts a policy exists.
**Test:** `tests/security/all-tables-have-rls.test.ts`.

**Claim 4.** A user from tenant A can never read or write rows from tenant B, even via SQL injection or parameter manipulation.
**Enforcement:** RLS is the *only* mechanism — application code does not duplicate `WHERE company_id = X` filters because that would mask RLS failures. Service role bypasses RLS only in webhook handlers and background jobs, where the company_id is derived from the webhook source contract.
**Test:** `tests/security/cross-tenant-leak.test.ts` — populates two tenants, authenticates as tenant A, runs every read endpoint, asserts no tenant B data appears.

**Claim 5.** Soft-deleted rows (`deleted_at IS NOT NULL`) are excluded from default read paths.
**Enforcement:** RLS policies include `deleted_at IS NULL` in the USING clause for all SELECT operations. Admin "view deleted" UI uses an explicit `with_deleted=true` query parameter that switches to a separate, audit-logged endpoint.

---

## 3. Authentication and session management

- **Office staff:** Supabase Auth, password + magic link, 30-day session, 2FA optional in v0.1, mandatory for `admin`/`super_admin` in v0.2.
- **Workers (PWA):** Magic link only (no password — keep it simple for non-tech users), 7-day session, foreground refresh on app open.
- **Public pages (quote acceptance):** No session — tokenized URL only. Token is a 256-bit random, 30-day expiry, single-use for the accept action, multi-use for view.

Session revocation:
- Admin can revoke any session immediately from `Settings → Users → Active sessions`.
- Worker sessions auto-revoke when admin marks worker as `inactive` in `workers` table.
- All revocations write to `activity_log` with action = `session_revoke`.

---

## 4. Webhook hardening (the v2 fix)

Every inbound webhook must satisfy all five gates in order. The shared handler in `lib/webhooks/handler.ts` enforces them. Per-source customizations live in `lib/webhooks/sources/{painlessremovals,gocardless,resend,meta,...}.ts`.

### Gate 1: Signature verification (HMAC over canonical payload)

The signature payload is `{timestamp}.{schema_version}.{raw_body}` joined with literal periods. The signature header is `X-Signature: hmac-sha256={hex}`.

```ts
const canonical = `${timestamp}.${schemaVersion}.${rawBody}`;
const expected = crypto.createHmac('sha256', secret).update(canonical).digest('hex');
const valid = crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(receivedHex));
```

**Why include timestamp and version in the HMAC:** without them, a captured payload can be replayed forever, and a future schema change cannot be enforced cryptographically.

### Gate 2: Timestamp freshness (replay protection)

```ts
const now = Date.now() / 1000;
const ts = parseInt(timestamp, 10);
if (Math.abs(now - ts) > 300) {  // 5 minutes
  return reject('stale_timestamp');
}
```

Tolerance is 5 minutes (handles clock skew). Replays beyond this window are rejected even with valid signature.

### Gate 3: Schema version pinning

```ts
const SUPPORTED_VERSIONS = ['1.0', '1.1'];  // each source maintains its own list
if (!SUPPORTED_VERSIONS.includes(schemaVersion)) {
  return reject('unsupported_schema_version');
}
```

When evolving the payload, increment the version on the sender, add the new version here, and keep the old one supported until all senders are upgraded.

### Gate 4: Idempotency

```ts
const eventId = extractEventId(payload);  // source-specific extraction
const claimed = await tryInsertEvent(source, eventId, payload);
if (!claimed) {
  return ok({ duplicate: true, event_id: eventId });
}
```

A `webhook_events` table row with unique `(source, event_id)` claims the event. If the row already exists, the request is treated as a successful duplicate and idempotently returns 200.

### Gate 5: Rate limit (per source)

```ts
const ok = await rateLimitCheck(`webhook:${source}:${ip}`, {
  windowSec: 60,
  maxRequests: 120
});
if (!ok) return reject('rate_limited', 429);
```

Per-source per-IP rate limit. Tunable per source — production GoCardless and Meta webhooks may need higher limits than internal painlessremovals.

### Per-source secrets and rotation

Each source has its own secret stored in env vars: `WEBHOOK_SECRET_PAINLESSREMOVALS`, `WEBHOOK_SECRET_GOCARDLESS`, etc.

Rotation procedure (every 90 days):
1. Generate new secret, set as `WEBHOOK_SECRET_<SOURCE>_NEW`
2. Update sender to use the new secret
3. Handler accepts both old and new for a 24-hour overlap
4. Remove old secret, rename `_NEW` to primary

### IP allowlist (optional, where source publishes IPs)

GoCardless and Meta publish their webhook source IP ranges. For these we add a final gate: if the request IP is not in the allowlist, reject. (Painlessremovals webhooks come from Cloudflare Workers' IPs which rotate, so we don't allowlist that source — we rely on signature + timestamp.)

---

## 5. Secrets and key management

### Secret storage

- **Database**: Supabase manages connection pool secrets. We never see them.
- **App env vars**: Cloudflare Workers secrets (`wrangler secret put ...`). Never committed to git. Never logged. Local dev uses `.dev.vars` which is in `.gitignore`.
- **Encryption keys**: `INTEGRATION_ENCRYPTION_KEY` is a 32-byte key for `pgcrypto`. Stored in Cloudflare Workers secrets only. Rotation requires re-encrypting all `integration_credentials` rows — handled by a manual migration script in `scripts/rotate-integration-key.ts`.

### Secret scanning in CI

`.github/workflows/secret-scan.yml` runs `git secrets` (or equivalent) on every PR. Detects committed AWS keys, Stripe keys, JWTs, OAuth secrets. Build fails on any match.

### Sentry DSN visibility

The Sentry DSN is intentionally public (it's a write-only key with origin restrictions). It can appear in client bundles. Do not confuse this with auth tokens.

---

## 6. PII handling contract

This is the contract that prevents customer data leaking to error trackers and logs.

### Sentry `beforeSend` hook

```ts
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  beforeSend(event, hint) {
    return scrubPII(event);
  },
  beforeBreadcrumb(breadcrumb) {
    return scrubBreadcrumb(breadcrumb);
  }
});
```

`scrubPII` rules:

**Always strip (replace with `[REDACTED]`):**
- Email-shaped strings (`/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+/`)
- Phone-shaped strings (`/\+?[\d\s\-()]{10,}/`)
- UK full postcodes (`/[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}/i`)
- Strings inside fields named `email`, `phone`, `name`, `address`, `notes`, `password`, `token`

**Postcode handling (special):**
Replace UK full postcodes with their **outward code only** (district, e.g., `BS1`, `BS9`). This preserves geographic debugging signal without identifying individuals. Rule: regex match the full postcode, keep only the outward code, append `XXX`. So `BS9 4AB` → `BS9 XXX`.

**Allowed in error context:**
- Job IDs (UUIDs are not PII for a CRM)
- Stage names (`lead`, `quoted`, etc.)
- Aggregate counts ("123 jobs in confirmed stage")
- Postcode districts (with redaction as above)
- Error class names and stack traces (after the body has been scrubbed)

### Application logs

Same scrubbing rules apply to `console.log`, `console.error`, and any structured logging. The shared `logger` in `lib/logger.ts` runs the same `scrubPII` on every log call.

### Database backups

Supabase backups are encrypted at rest by default. Long-term archives older than 90 days are encrypted with a separate key (rotated annually) before being stored in Cloudflare R2. Customer-data exports for "right to be forgotten" requests must include backup deletion within 90 days (GDPR compliant).

### GDPR data subject requests

- **Access request**: A `Settings → Data Subject Requests` admin page generates a JSON export of all rows where the customer's email or phone matches.
- **Deletion request**: Marks `customers.deleted_at` and triggers a 30-day cooling-off period before hard delete (handles undo of accidental requests). Hard delete cascades to related rows where allowed by accounting law (note: financial records must be retained for 6 years per HMRC, so customer data is anonymized, not deleted, in `invoices`/`payments`).

---

## 7. Cloudflare Workers-specific concerns

### Worker isolate boundary

Each request handler runs in an isolate. Module-level globals are *per-isolate* and survive between requests but not between isolates. Do **not** put per-tenant state in module globals — Supabase clients must be created fresh per request and use the request's auth context.

### KV is public-readable to the calculator

`PRICING_KV` and `AVAILABILITY_KV` are bound to both the CRM Worker (read/write) and the painlessremovals Worker (read-only). Anyone who can reach the calculator can read these values. Therefore: no PII, no internal cost data, no margin secrets in KV. The pricing config that lands in KV is the *public-facing* portion only — internal-only fields (e.g., overhead absorbed in margin computation) stay in the database.

### Service role usage

The Supabase service role bypasses RLS. It must only be used in:
- Webhook handlers (where the company_id is derived from the webhook source contract)
- Background jobs (Cloudflare Cron triggers) where the company_id is supplied by the job definition
- Migration scripts run by deploy

Every service-role usage logs the operation to `activity_log` with `actor_id = NULL` and `action = 'system_<job_name>'`.

---

## 8. Audit log requirements

Every mutation on every business table is recorded in `activity_log`. The trigger is defined in `references/audit-log.md`. Three guarantees:

1. **No bypass.** Even service role mutations are audited (the trigger runs regardless).
2. **No modification.** `activity_log` itself has no UPDATE or DELETE policy — only INSERT. Once a row is written, it's permanent.
3. **Searchable.** Indexed on `(company_id, entity_type, entity_id, occurred_at desc)` for fast customer/job activity tab queries.

Retention: indefinite for v0.1. v0.2 may add archival rules (e.g., move rows older than 2 years to a cold partition).

---

## 9. Compliance assertions in CI

Every PR runs `tests/security/` which asserts:

1. No `company_id IS NULL` in any business table fixture (Claim 1)
2. RLS policy exists on every business table (Claim 3)
3. Cross-tenant leak test passes (Claim 4)
4. Soft-delete RLS test passes (Claim 5)
5. PII scrubber correctly handles email, phone, full postcode, name (random fuzz inputs)
6. Webhook handler rejects: bad signature, stale timestamp, unsupported schema version, replay, rate-limit overflow
7. Service role usage in non-allowed paths fails grep check

A red CI build is a security regression. Do not merge.
