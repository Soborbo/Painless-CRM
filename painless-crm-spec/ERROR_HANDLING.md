# Error Handling

**Status:** canonical
**Last updated:** spec v2

This document defines the error code namespace, retry policy, user-facing error UX, and Sentry breadcrumb rules. Other docs reference this for "what happens when X fails".

---

## 1. Error code namespace

All thrown errors include an `error_code` string field. Codes follow the pattern:

```
{DOMAIN}.{KIND}.{SPECIFIC?}
```

- **DOMAIN**: `auth`, `tenant`, `job`, `quote`, `pricing`, `payment`, `xero`, `gocardless`, `webhook`, `pwa`, `report`, `system`
- **KIND**: `not_found`, `forbidden`, `invalid`, `conflict`, `rate_limited`, `timeout`, `external_failure`, `bug`, `unknown`
- **SPECIFIC** (optional): an additional disambiguator when multiple variants exist

Examples:
- `job.invalid.stage_transition_not_allowed`
- `quote.not_found`
- `webhook.invalid.signature`
- `webhook.invalid.stale_timestamp`
- `xero.external_failure.rate_limited`
- `pricing.invalid.no_active_version`

---

## 2. Standard codes (canonical list, extend as needed)

### Auth domain

| Code | Meaning | HTTP | Surfaceable to user? |
|------|---------|------|----------------------|
| `auth.forbidden` | User authenticated but lacks role/permission | 403 | yes (generic) |
| `auth.not_found` | User row missing despite valid auth | 401 | no — log only |
| `auth.invalid.session` | Session expired or revoked | 401 | yes (redirect to login) |
| `auth.rate_limited` | Too many login attempts | 429 | yes |

### Tenant domain

| Code | Meaning | HTTP | Surfaceable? |
|------|---------|------|--------------|
| `tenant.not_found` | company_id resolved to nothing | 401 | no — log + alert |
| `tenant.forbidden.cross_tenant` | Attempted to access another tenant's row | 403 | no — alert immediately |

### Job domain

| Code | Meaning | HTTP | Surfaceable? |
|------|---------|------|--------------|
| `job.not_found` | jobs.id doesn't exist for this tenant | 404 | yes |
| `job.invalid.stage_transition_not_allowed` | Tried e.g. lead → accepted (must go via quoted) | 422 | yes |
| `job.invalid.required_field_missing` | Transition to stage requires field X (per STATE_MACHINE §3) | 422 | yes (with field name) |
| `job.conflict.version_mismatch` | Optimistic lock failed | 409 | yes (suggest reload) |

### Quote domain

| Code | Meaning | HTTP | Surfaceable? |
|------|---------|------|--------------|
| `quote.not_found` | Token expired or invalid | 410 | yes (custom page) |
| `quote.invalid.already_accepted` | Customer tried to accept twice | 409 | yes |
| `quote.invalid.expired` | Past `quote_validity_days` | 410 | yes |

### Pricing domain

| Code | Meaning | HTTP | Surfaceable? |
|------|---------|------|--------------|
| `pricing.not_found.active_version` | No published pricing version | 500 | no — alert |
| `pricing.invalid.config` | Margin matrix sums incorrectly | 500 | no — alert |

### Webhook domain

| Code | Meaning | HTTP | Sender action |
|------|---------|------|---------------|
| `webhook.invalid.signature` | HMAC mismatch | 401 | fix auth |
| `webhook.invalid.stale_timestamp` | Outside 5-min window | 401 | fix clock |
| `webhook.invalid.unsupported_schema_version` | Version not in allowlist | 400 | upgrade payload |
| `webhook.invalid.payload` | Zod schema validation failed | 400 | fix payload |
| `webhook.invalid.missing_event_id` | No event_id extracted | 400 | fix payload |
| `webhook.rate_limited` | Per-source rate limit | 429 | back off |
| `webhook.external_failure.processing` | Process function threw | 500 | retry with backoff |

### Xero / GoCardless domains

| Code | Meaning | HTTP | Action |
|------|---------|------|--------|
| `xero.external_failure.rate_limited` | Xero 429 | 503 | retry per Retry-After |
| `xero.external_failure.token_expired` | Refresh failed | 503 | mark credentials, alert |
| `xero.external_failure.5xx` | Xero server error | 503 | exponential backoff |
| `xero.invalid.validation` | Xero rejected payload | 422 | log + manual review |
| `gocardless.external_failure.*` | Same pattern | 503 | same |

### PWA domain

| Code | Meaning | HTTP | UX |
|------|---------|------|----|
| `pwa.invalid.gps_too_far` | Clock-in >threshold from job address | 422 | warning + reason field |
| `pwa.conflict.duplicate_event` | Same client_event_id replayed | 200 | silent (idempotent) |

### System domain

| Code | Meaning | HTTP | Action |
|------|---------|------|--------|
| `system.bug` | Unexpected — assert that should never fail | 500 | Sentry alert + log |
| `system.unknown` | Caught error with no clear classification | 500 | Sentry alert + log |
| `system.timeout` | Operation exceeded deadline | 504 | retry once, then user-fail |

---

## 3. Retry policy by domain

| Domain | Retry on | Backoff | Max attempts | Notes |
|--------|----------|---------|--------------|-------|
| Webhook (inbound) | n/a — sender retries | sender's responsibility | sender's responsibility | We just respond with the right code |
| Webhook (outbound, e.g., we call Xero) | 5xx, 429, timeout | 1s, 5s, 30s, 5m | 4 | Then enter dead-letter queue |
| Xero API | 5xx, 429, timeout | per Retry-After or 1s/5s/30s/2m | 4 | Auth errors mark expired immediately |
| GoCardless API | same | same | 4 | same |
| Resend | 5xx, 429 | 1s, 30s, 5m | 3 | Email failures surface to admin |
| Anthropic API | 5xx, timeout | 1s, 5s | 2 | AI is enrichment — fail open after retries |
| Cloudflare KV write | rare 5xx | 1s, 5s | 2 | Then surface error to admin |
| Supabase queries | timeout, connection error | 100ms, 500ms, 2s | 3 | Avoid retrying user mutations on 4xx |
| PWA offline queue | network failure | 1s, 5s, 30s, 5m, 30m | 5 | Then surface in PWA UI for manual retry |

**Hard rule:** never retry on 4xx (except 429). 4xx means the request is wrong; retrying does not fix it.

**Idempotency rule:** retries are only safe if the operation is idempotent. Use `Idempotency-Key` headers when the API supports them (Xero, GoCardless, Stripe). Use deterministic dedup keys when not (`{provider}-{entity_type}-{entity_id}`).

---

## 4. Dead-letter queue (DLQ)

When a retry policy exhausts:

- The failed operation is recorded in `dead_letter_queue` table with: payload, last error, retry count, related entity ID
- An admin notification is sent (email + in-app)
- Admin UI page `/system/dlq` shows pending items with manual retry / manual cancel buttons
- DLQ items are reviewed daily; older than 7 days unresolved → escalate

```sql
-- Conceptual; full schema in v0.2 when we add this
create table dead_letter_queue (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null,
  origin text not null,           -- 'xero_sync', 'gocardless_payment', 'webhook_processing'
  related_entity_type text,
  related_entity_id uuid,
  payload jsonb not null,
  last_error_code text,
  last_error_message text,
  retry_count int not null default 0,
  next_retry_at timestamptz,
  resolved_at timestamptz,
  resolved_by_id uuid references users(id),
  resolution_notes text,
  created_at timestamptz default now()
);
```

Implementation: post-v0.1 (added in v0.2 as Xero sync work begins).

---

## 5. User-facing error UX

### Server Action errors

Every Server Action returns a discriminated union:

```ts
type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; field?: string } };
```

- `code` is the canonical error code (programmatic)
- `message` is the i18n key for user display
- `field` is the form field name (for validation errors)

### Form validation

Zod errors from `schema.parse()` are caught in the Server Action wrapper and converted to:

```ts
{ ok: false, error: { code: 'auth.invalid.field', message: 'errors.field.email_invalid', field: 'email' } }
```

The form component shows the localized message under the named field.

### Generic unhandled errors

For `system.bug` / `system.unknown`, the user sees:

> Something went wrong. We've been notified and are looking into it. Reference: `{event_id}`

`event_id` is the Sentry event UUID. Admin can search Sentry for that ID.

Never show stack traces or technical error messages to end users.

### Page-level errors (App Router error boundaries)

Each route group has an `error.tsx` boundary. Office UI errors show "Something went wrong, try again, or contact support". Worker PWA errors are more terse ("Connection issue. Tap to retry") and offer offline-friendly fallbacks.

---

## 6. Sentry breadcrumb rules

Add breadcrumbs for:

- **Stage transitions** — `state.transition`, `state.revert`, `state.transition_failed`
- **Webhook received** — `webhook.received`, `webhook.rejected`, `webhook.duplicate`
- **External API call** — `external.{provider}.request`, `external.{provider}.response`
- **Auth events** — `auth.login`, `auth.session_revoked`
- **PWA sync events** — `pwa.sync_started`, `pwa.sync_completed`, `pwa.sync_failed`

Breadcrumbs go through `scrubPII` (per SECURITY_MODEL.md §6) before being captured.

Sample `beforeBreadcrumb`:

```ts
function scrubBreadcrumb(crumb: Sentry.Breadcrumb) {
  if (crumb.message) {
    crumb.message = scrubPII(crumb.message);
  }
  if (crumb.data) {
    crumb.data = Object.fromEntries(
      Object.entries(crumb.data).map(([k, v]) =>
        typeof v === 'string' ? [k, scrubPII(v)] : [k, v]
      )
    );
  }
  return crumb;
}
```

---

## 7. Don't catch what you can't fix

Common anti-pattern: wrapping every server call in try/catch and silently swallowing errors. We don't do this. Rules:

- Catch only when you have a specific recovery action
- If you don't have a recovery action, let the error bubble up to the route's error boundary or the Server Action error wrapper
- Never log-and-return-undefined — if you can't recover, throw

Allowed catch patterns:

- Caught at the API boundary (route handler / Server Action wrapper) to convert to `ActionResult.error`
- Caught in webhook process functions to convert to `{ ok: false, reason }` (the handler then writes to webhook_events)
- Caught in retry loops where the retry IS the recovery action
- Caught for AI/enrichment fallback ("if Anthropic fails, proceed without duplicate detection")

Forbidden patterns:

- `try { ... } catch (e) { console.log(e); return null; }` ← swallows errors
- `try { ... } catch { /* ignore */ }` ← silent failure
- Catching one specific exception type and re-throwing as a different one without preserving context

---

## 8. Compliance assertions in CI

`tests/error-handling/` asserts:

1. Every Server Action's error path returns a properly-shaped `ActionResult`
2. No `console.log(error)` patterns in source (linter rule)
3. No `catch { ... }` without re-throw or recovery (linter rule)
4. Sentry `beforeSend` includes the `scrubPII` call
5. The error code namespace is documented (this file is up-to-date)
