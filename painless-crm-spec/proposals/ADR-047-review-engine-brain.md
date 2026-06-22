# ADR-047 (proposed) — Adopt the Review Engine "brain" natively, single-tenant

**Date:** 2026-06-22
**Status:** proposed — Phase-1 decisions locked 2026-06-22 (see §7); awaiting go-ahead to write code
**Author:** integration review of `Soborbo/reviewengine` (`reviewengine-main`, v0.4.0)
**Next free ADR number:** ADR-047 (current max is ADR-046). Promote into `DECISIONS.md` on approval.

---

## Context

We already have a working but **thin** review-request flow (Phase 11, ADR-010):

- `src/lib/reviews/followup.ts` — pure `decideReviewAction` cadence (initial +24h after `paid`, follow-ups +7d/+14d, stop on click).
- `src/lib/reviews/review-cron.ts` — thin sweep shell; sends via Resend, advances the row.
- `src/lib/reviews/enqueue.ts` — one `review_requests` row per sign-off on `paid`.
- `src/app/r/[token]/review/route.ts` — public click redirect → records `responded_at` → 302 to Google.
- `src/app/api/cron/review-requests/route.ts` — HMAC-guarded hourly trigger.
- `review_requests` / `customer_signoffs` / `complaints` tables (migration 42), `companies.gmb_place_id`.

The external **Review Engine** (`Soborbo/reviewengine`) is a more capable implementation of the *same idea* with the *same compliance stance* (no gating; complaint link in every message; List-Unsubscribe + suppression). It is built as Cloudflare Workers + Hono + Zod, with a clean **portability seam (its spec §14)**: `core/` (the brain) and `channels/` are DB-agnostic; only `repo/` is storage-specific, and a complete **Postgres/Supabase** repo already exists (`src/repo/supabase.ts`, `migrations/supabase/*`, `src/index.embedded.ts`).

It is **multi-tenant** by `review_campaign` + `project_key`/`campaign_id` row-tenancy. We do **not** want that — Painless CRM is its own tenant boundary (`company_id` + RLS). The ask: bring in the **brain only**, single-tenant, native to CRM conventions.

### What the engine has that we don't (the "why")

| Capability | CRM today | Engine | Value |
|---|---|---|---|
| Crash-safe send (claim → send → confirm, idempotency key, reconcile stuck claims) | ❌ send-then-update → a crash mid-send re-sends next sweep | ✅ `review_send_log` UNIQUE idempotency row | **High** — kills double-sends |
| Suppression list + List-Unsubscribe one-click + provider webhook → suppression | ❌ none (no bounce/spam/unsub feedback) | ✅ `review_suppression` + `/webhooks/brevo` + `List-Unsubscribe` headers | **High** — deliverability + compliance |
| Daily cap / warmup ramp / anti-starvation budget | ❌ sends all due at once | ✅ `windowBudget`, ramp, per-window spread | Medium — domain reputation |
| A/B subject variants + per-variant funnel | ❌ fixed copy | ✅ `review_variant` weighted pick + attribution | Medium — optimisation |
| Funnel analytics (sent/clicked/reviewed/complained rates) | ❌ none surfaced | ✅ `funnel()` / `funnelVariants()` | Medium — visibility |
| Multi-platform (Trustpilot/Facebook beyond Google) | ❌ Google only | ✅ `platforms[]` + `/r?p=` | Low/optional |
| GDPR erase + retention purge | partial (global soft-delete) | ✅ explicit `erase()` / `purgeExpired()` | Medium |

## Decision (proposed)

Adopt the engine's **`core/` brain** into the CRM as a native module and **extend the existing Phase-11 flow** with it — *not* deploy the engine as a sidecar, and *not* duplicate its multi-tenant tables.

Concretely:

1. **Port `core/` verbatim-ish** (logic, time, crypto, templates, types) into `src/lib/reviews/engine/`. It is pure + Zod-only; the Vitest unit tests (`test/logic.test.ts`, `test/time.test.ts`) port directly.
2. **Re-implement the `repo/` seam on `@supabase/supabase-js`** (CRM rule 6: no raw SQL; postgres.js is out), scoped by `company_id` with RLS — replacing the engine's `postgres.js` + service-role-bypass model.
3. **Reuse, don't rebuild**, the CRM's existing surfaces: the `review_requests` table (extended), the `/r/[token]/review` route, the `/feedback/[token]` complaint route, the `cron/review-requests` trigger, and the Resend integration.
4. **Implement `ResendChannel`** against the engine's `Channel` interface (wrapping `lib/integrations/resend/safe-send.ts`) + a new `/api/webhooks/resend` (mandatory webhook-v2 handler) feeding suppression.
5. **Drop multi-tenancy**: no `review_campaign` table. Campaign settings become **company-scoped config** (one effective config for Painless); `project_key`/`campaign_id` collapse to `company_id`. Suppression scope `global|project` → company-scoped.
6. **Audit via the existing trigger** (CRM rule 10) — drop the engine's `review_audit`; let `activity_log` capture changes.

Cadence is set to **`scheduleDays = [1, 4, 7, 14]`** — 4 sends at +24h, +4d, +7d, +14d after `paid` (a deliberate move from today's 3-send policy to one extra nudge). Beyond cadence, the wins are crash-safety, suppression, A/B and funnel.

## Alternatives considered

- **B — Sidecar embedded instance** (deploy the engine as-is, Hyperdrive → our Supabase, CRM calls signed `/ingest` + receives signed callbacks). *Rejected as the target* (kept as a possible fast interim): it works today with ~zero porting, but it is **not "built in"** — two deploys, cross-service HMAC, Brevo instead of Resend, and D1-style tables (`TEXT` PKs, `TEXT` timestamps, `INTEGER` booleans, no `company_id`/RLS/`version`/soft-delete/audit-trigger) sitting outside the CRM tenancy model. Contradicts the "csak review brainként, beépítve" requirement.
- **Keep the current thin flow, add only suppression.** Rejected: we'd reinvent the engine's crash-safe send and A/B/funnel piecemeal, having a correct reference implementation in hand.
- **Bring the engine's `review_request` table wholesale (option b).** Rejected in favour of extending the deployed `review_requests` (option a) — the merge RPC (migration 62), the token route, and FKs already target `review_requests`; a parallel table would duplicate the domain.

## Consequences

- **Cost:** the `repo/` rewrite (postgres.js raw SQL → supabase-js, split to ≤200-line files per rule 7) is the bulk of the work; plus `ResendChannel` + Resend webhook + suppression table + schema extension. Estimate **~1 focused week for Phase 1** (email-only, crash-safe, suppression), A/B + funnel + multi-platform as follow-ups.
- **Schema:** one new migration (63) — extend `review_requests`, add `review_send_log`, `review_suppression`, `review_variant` (all `company_id` + RLS + `version` + `deleted_at`), optional `review_quota`. Touches a review-domain spine table → this ADR is the gate.
- **New integration:** Resend **inbound** webhook (`/api/webhooks/resend`) — first use; `WEBHOOK_SECRET_RESEND` per INTEGRATION_CONTRACTS §8.
- **Upstream divergence:** we fork the brain; future engine updates are cherry-picked, not pulled. Acceptable — `core/` is small and stable.
- **Compliance improves:** List-Unsubscribe one-click + persistent suppression land for the first time.

---

# Implementation plan (the "how")

## 1. File inventory — source → destination

| Engine (`reviewengine-main`) | CRM destination | Action |
|---|---|---|
| `src/core/types.ts` | `src/lib/reviews/engine/types.ts` | Port; trim multi-tenant fields (`projectKey`, `webhookSecret`, campaign-as-tenant) |
| `src/core/logic.ts` (`decideAction`, `windowBudget`, email checks) | `src/lib/reviews/engine/logic.ts` | Port ~as-is (pure) — supersedes `followup.ts` |
| `src/core/time.ts` (`computeNext`, windows, ramp) | `src/lib/reviews/engine/time.ts` | Port ~as-is |
| `src/core/crypto.ts` (token, HMAC) | `src/lib/reviews/engine/crypto.ts` | Port; HMAC only needed if we keep List-Unsubscribe signing |
| `src/core/templates/{en,hu,index}.ts` | CRM i18n + `lib/integrations/resend/review-request.ts` | Fold into existing email builder + next-intl |
| `src/repo/ReviewRepository.ts` | `src/lib/reviews/repo/types.ts` | Keep interface; **drop** campaign-CRUD + multi-tenant methods |
| `src/repo/supabase.ts` (postgres.js) | `src/lib/reviews/repo/*.ts` | **Rewrite** on supabase-js, `company_id`-scoped, split ≤200 lines |
| `src/channels/Channel.ts` | `src/lib/reviews/channels/Channel.ts` | Port interface |
| `src/channels/brevo.ts` | `src/lib/reviews/channels/resend.ts` | **Replace** with `ResendChannel` over `safe-send.ts` |
| `src/channels/whatsapp.ts` | (Phase 3) `lib/integrations/twilio` or Meta | Defer |
| `src/adapters/cron.ts` (`runSendTick`, `sendOne`, `runMaintenance`) | `src/lib/reviews/sweep.ts` | Port the engine loop; **supersedes** `review-cron.ts` |
| `src/adapters/routes.ts` (`/r /c /s /u`, `/ingest`, brevo webhook) | existing `/r/[token]/review`, `/feedback/[token]`, new `/u/[token]`, `/api/webhooks/resend` | Map onto CRM routes; `/ingest` → internal Server Action (no HMAC) |
| `src/adapters/admin-api.ts` + `public/admin.html` | CRM dashboard pages | **Drop**; rebuild funnel/variant/suppression views in CRM UI (Phase 2) |
| `src/index.ts` / `index.embedded.ts` / `wrangler*.jsonc` | — | **Drop** (no separate Worker; we live in the Next app) |
| `test/{logic,time}.test.ts` | `src/lib/reviews/engine/__tests__/` | Port directly (Vitest both sides) |

## 2. Schema — migration `00000000000063_review_engine_brain.sql`

**Extend `review_requests`** (keep `id` as the public token; keep existing columns):
- `attempts_sent int not null default 0`
- `last_sent_at timestamptz`, `next_send_at timestamptz`, `trigger_at timestamptz` (default = `paid_at`)
- `clicked_platform text`, `manual_reviewed boolean not null default false`
- widen `status` CHECK to the engine set: `pending|active|reviewed|complained|unsubscribed|exhausted` (map current `clicked|expired` → `active|exhausted`).

**New tables** (all: `company_id uuid not null`, RLS `company_id = current_user_company_id()`, `version`, `deleted_at` where it makes sense, idiomatic `uuid`/`timestamptz`/`boolean`/`jsonb`):
- `review_send_log` — `request_id`, `attempt_no`, `channel`, `template_id`, `variant_id`, `idempotency_key UNIQUE`, `sent_at`, `provider_id` (NULL = claimed/in-flight). The crash-safe seam.
- `review_suppression` — `email`, `reason (hard_bounce|spam_complaint|unsubscribe|manual)`, `created_at`, `UNIQUE (company_id, email)`. (No `scope` — single tenant.)
- `review_variant` — `template_key`, `label`, `subject`, `weight`, `active`. A/B.
- `review_quota` *(optional, Phase 1.5)* — `day date`, `sent_count`. Daily cap/ramp metering.

**Drop from the model:** `review_campaign` (→ company config), `review_audit` (→ `activity_log` trigger).
**Settings home:** campaign settings (send hours/days, scheduleDays, postClick, dailyCap, ramp, fromEmail/Name, platforms, retentionDays) live as **company config** (reuse the Phase 25 config plumbing, migration 48) — one effective config for Painless.

## 3. The brain ↔ CRM mapping

- **Tenancy:** every repo method takes/asserts `company_id`; `campaign` → the company config object; `projectKey`/`campaignId` → `company_id`.
- **Token:** reuse `review_requests.id` (UUID v4 is unguessable enough; drop the engine's separate `token`/`randomToken`). Idempotency key = `${requestId}:${attempt}`.
- **Enqueue:** keep `enqueueReviewRequest` on `paid`; set `trigger_at = paid_at`, `next_send_at = initialNextSend(...)`.
- **Sweep:** replace `runReviewRequestSweep` with the ported `runSendTick` (claim → render → Resend send → confirm; `decideAction` drives nudge/post_click/exhausted). Add `runMaintenance` (reconcile stuck claims, retention purge) on the daily cron.
- **Click routes:** `/r/[token]/review` keeps recording the soft signal (engine resolves the review-click in the tick, not the route, to dodge scanner pre-clicks — adopt that). `/feedback/[token]` = the engine's `/c` (→ `complaints`). New `/u/[token]` = unsubscribe → `review_suppression` + close active.
- **Channel:** `ResendChannel.send()` wraps `safe-send.ts`; adds `List-Unsubscribe` + `List-Unsubscribe-Post: One-Click` headers and a `tags: [company]` for webhook attribution.
- **Suppression webhook:** `/api/webhooks/resend` (webhook-v2 `createWebhookHandler`, `WEBHOOK_SECRET_RESEND`) → on `bounced/complained/unsubscribed` → `addSuppression` + close active requests for that email. Check suppression at enqueue **and** at send.

## 4. Compliance (must hold — ADR-010 + engine spec §2)

No gating (every recipient gets the Google link + complaint link); complaint route always present; `List-Unsubscribe` one-click on every send; persistent suppression. Capacity bounded by Resend plan + warmup ramp, not a hard cap.

## 5. Test plan

- Port `logic.test.ts` + `time.test.ts` (pure, pass unchanged).
- New: repo tests against a Supabase test schema (claim/confirm idempotency, suppression, reconcile).
- New: sweep integration test (due selection, post_click close, exhausted).
- E2E (Playwright): click `/r` → `responded_at` set, no further sends; unsubscribe → suppressed.

## 6. Phased rollout

- **Phase 1 (MVP, ~1 wk):** core port + supabase-js repo + `ResendChannel` + Resend webhook + suppression + crash-safe sweep + schema 63 + ported unit tests. Cadence unchanged.
- **Phase 2:** A/B variants + funnel views in the CRM dashboard; GDPR erase/retention wired to CRM soft-delete/audit.
- **Phase 3:** WhatsApp/SMS channel via Twilio; multi-platform (Trustpilot/Facebook).

## 7. Resolved decisions (2026-06-22)

1. **Cadence:** `scheduleDays = [1, 4, 7, 14]` — **4 sends** at +24h / +4d / +7d / +14d after `paid`. (Replaces the current 3-send policy.) A click on any link still stops the sequence.
2. **Quota / warmup ramp:** **deferred.** Phase 1 ships with an effectively unlimited `dailySendCap` and no ramp. Revisit only if volume grows or deliverability dips. (`dailySendCap` = per-day send ceiling; `ramp` = gradual daily-volume increase to warm a new sender's reputation.)
3. **Funnel UI:** **Phase 2** — a dedicated dashboard page under `reports/`.
4. **Review platforms:** **Google only.** No Trustpilot/Facebook multi-platform; the engine's `platforms[]` / `/r?p=` machinery is dropped from the port (re-addable later).

## 8. Scope lock (Phase 1)

In: core brain port (`scheduleDays = [1,4,7,14]`), supabase-js `company_id`-scoped repo, `ResendChannel`, `/api/webhooks/resend` → suppression, `List-Unsubscribe`, crash-safe sweep + daily maintenance, migration 63, ported unit tests, Google-only redirect.
Out (later phases): A/B + funnel UI (P2), GDPR erase/retention UI wiring (P2), quota/ramp (when needed), WhatsApp/SMS + multi-platform (P3).
