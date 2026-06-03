# Architecture Decision Records (ADRs)

A chronological log of significant architectural decisions. Each ADR captures: the context, the decision, the alternatives considered, and the consequences. New decisions are appended; superseded decisions stay in place but are marked.

Format adapted from Michael Nygard's ADR template, kept short for solo project tempo.

---

## ADR-001 — Job-centric domain model
**Date:** v1 spec
**Status:** accepted
**Context:** iMVE distinguishes "leads" and "jobs" as separate entities. Most modern CRMs do too. But this duplicates state machines, duplicates relationships to customers/quotes/communications, and creates the lead→job conversion problem that everyone solves badly.
**Decision:** A "lead" is `jobs.stage = 'lead'`. There is no `leads` table. The pipeline is one entity through its full lifecycle.
**Alternatives considered:**
- Separate leads table → rejected, double bookkeeping
- Polymorphic "opportunities" pattern → rejected, over-abstracted for one company
**Consequences:** Some queries get a `WHERE stage IN ('lead','contacted','quoted')` filter where competitors would have a `FROM leads`. The kanban benefits — no conversion event, just stage transitions.

---

## ADR-002 — Multi-tenant from day 1, single tenant at launch
**Date:** v1 spec
**Status:** accepted
**Context:** Painless is the first user. The medium-term goal (18+ months) is white-labelling for other UK removals companies. Bolting multi-tenant onto a single-tenant database later is famously expensive.
**Decision:** Every business table has `company_id UUID NOT NULL`. RLS policies via `current_user_company_id()`. Painless's company_id is the constant `'00000000-0000-0000-0000-000000000001'`. Single tenant in production until v0.3+.
**Alternatives considered:**
- Single-tenant launch, retrofit later → rejected, see history of every CRM that did this
- Per-tenant database → rejected, operational burden too high for solo
**Consequences:** Slight ergonomic cost (one extra column on every insert), big future-proof win. Tested via cross-tenant leak test in CI.

---

## ADR-003 — Next.js 16.2 + Cloudflare Workers + Supabase
**Date:** v1 spec
**Status:** accepted (with Phase 0 smoke-test gate)
**Context:** Need a stack that handles complex relational data, multi-tenant security, real-time collab, and document/image generation. Solo team, 13–21 month build.
**Decision:** Next.js 16.2 (App Router, Turbopack default, React Compiler 1.0, Adapters API stable), Cloudflare Workers Paid (already owned), `@opennextjs/cloudflare` adapter, Supabase Pro EU region, Tailwind v4, shadcn/ui.
**Alternatives considered:**
- Vercel + Next.js → would have lower friction; held in reserve as Phase 0 fallback
- Bare-metal Postgres (no Supabase) → too much auth/RLS plumbing for solo build
- T3 stack (Drizzle + tRPC) → fine technically, but Supabase Auth + RLS contract is the critical accelerator
**Consequences:** Phase 0 has 4 smoke tests (PDF gen, image processing, Realtime over WS, Excel export). If 2+ fail, switch CRM to Vercel before Phase 1. Code stays vendor-neutral so the switch is cheap.

---

## ADR-004 — Customer model: B2C + B2B unified with type discriminator
**Date:** v1 spec
**Status:** accepted
**Context:** Painless serves both individual movers (B2C) and estate agencies / care homes / property managers (B2B with multiple contacts). Two separate tables = duplication of contact, communication, address relationships. One unstructured table = data quality nightmare.
**Decision:** One `customers` table with `customer_type` discriminator (`individual` or `business`), check constraints enforce that B2C has a primary contact name and B2B has a company name. `customer_contacts` table for the multi-contact case (B2B has many, B2C usually has one which is the customer). `customer_relationships` table for spouse_of, employee_of, referred_by.
**Alternatives considered:**
- Separate `individuals` and `businesses` tables → rejected, kills uniformity in jobs/quotes/communications
- Single contacts table with optional company link → rejected, loses the natural business identity
**Consequences:** `customer_contacts` is a join table that always has at least one row per customer. UI flows for create-B2C and create-B2B are different even though they hit the same table.

---

## ADR-005 — Pricing engine: CRM is master, KV broadcasts to calculator
**Date:** v1 spec
**Status:** accepted
**Context:** The painlessremovals.com calculator and the CRM both need pricing config. Two copies will diverge. One copy with HTTP fetch = latency on every quote.
**Decision:** CRM database holds pricing as `pricing_versions` immutable snapshots. On publish, CRM writes the active version to Cloudflare KV at `pricing:current`. Calculator reads from KV (sub-millisecond at edge). Build-time fallback in calculator repo for cold starts.
**Alternatives considered:**
- Calculator pulls via HTTP from CRM API → ~100ms per quote, makes calculator slow
- Shared NPM package → rebuild + redeploy of both repos for any pricing change, too painful
**Consequences:** Quote freeze is enforced via `quotes.pricing_version_id` snapshot — quotes don't read KV at quote time, they reference the version they were generated against. KV change cannot retroactively affect issued quotes. See Phase 5 for full pattern.

---

## ADR-006 — Workers (loaders) are contractors, not employees
**Date:** v1 spec
**Status:** accepted
**Context:** Painless's existing model — and the UK removals industry standard — is that crew members are self-employed contractors paid per job, not PAYE employees.
**Decision:** `workers` table is separate from `users` table. No HMRC RTI integration. Worker payroll = contractor invoice generation. `users` table is for office staff (and any worker who needs PWA login).
**Alternatives considered:**
- Workers as users with a `loader` role → rejected, PWA login doesn't require a CRM user record for workers without phones
- Full HRIS integration → out of scope, Painless has 8–15 contractors not employees
**Consequences:** Worker availability poll, vehicle assignment, time entries all reference `workers.id` not `users.id`. A subset of workers also exist as users (for PWA login), linked via `workers.user_id`.

---

## ADR-007 — Audit log skips tables without `company_id`
**Date:** v2 spec (replaces v1 trigger that would have crashed)
**Status:** accepted
**Context:** The v1 audit trigger used `NEW.deleted_at` and `NEW.company_id` directly, which fails at runtime on the 49 tables that don't have those columns. Need a defensive pattern that allows attaching the trigger to any table.
**Decision:** Audit trigger uses `to_jsonb(NEW)->>'column'` accessor pattern, which returns null for missing columns instead of throwing. Tables without `company_id` are silently skipped (the audit row's `company_id` would be null, which violates the activity_log NOT NULL constraint anyway). Tables explicitly intended to never be audited (companies, activity_log, integration_credential_access_log) are listed in `tables_no_audit` migration view.
**Alternatives considered:**
- Maintain two triggers (with-deleted-at vs without) → rejected, doubles maintenance
- Add `deleted_at` and `company_id` to every table → rejected, semantically wrong (e.g., enums, lookups)
- Accept the runtime crash and only attach trigger to compatible tables → rejected, fragile
**Consequences:** Slight overhead (`to_jsonb` cast on every mutation, ~5% slower than direct field access on benchmarks). Acceptable for our throughput. Compliance test ensures the trigger is attached to every table that has both `id` and `company_id`.

---

## ADR-008 — Payment allocations as a proper relational table
**Date:** v2 spec (replaces v1 JSONB allocations)
**Status:** accepted
**Context:** v1 stored payment allocations as `payments.allocations jsonb`. This is fine for "single payment, single invoice" cases but breaks down for partial payments, overpayments, refunds, write-offs, and credit notes. Cannot answer "what is the unallocated balance on this payment" with a query.
**Decision:** New `payment_allocations` table with `(payment_id, invoice_id, allocation_type, amount_pence)`. Allocation types: `payment_to_invoice`, `refund`, `write_off`, `credit_note_applied`, `overpayment_held`. Refunds and write-offs are negative `amount_pence`. View `payments_with_balance` exposes unallocated balance.
**Alternatives considered:**
- Keep JSONB → rejected, accounting team will hate us in v0.2
- Use Xero as system of record for allocations → rejected, we need to function before/without Xero sync
**Consequences:** Phase 12 is more involved than v1 estimated (~1 extra week). Migration from v1 JSON allocations on first deploy is a one-time script. Worth it.

---

## ADR-009 — OAuth credentials in dedicated encrypted table
**Date:** v2 spec
**Status:** accepted
**Context:** v1 mentioned `xero_oauth_tokens` in Phase 12 narrative but didn't add it to the schema. Need same pattern for GoCardless, Google Ads, Meta Ads, etc. Several providers, similar lifecycle, all need encryption at rest.
**Decision:** Single generic `integration_credentials` table with `provider` discriminator. Tokens encrypted with `pgcrypto` using `INTEGRATION_ENCRYPTION_KEY` env var. Access logged to `integration_credential_access_log`. Refresh failure tracking. One row per (company_id, provider, external_account_id).
**Alternatives considered:**
- Per-provider tables → rejected, 6+ similar tables
- Tokens in env vars → rejected, doesn't scale to multi-tenant SaaS where each tenant has their own Xero
- External secret manager (Vault, etc.) → over-engineered for solo build
**Consequences:** Key rotation requires re-encrypting all rows (manual script). Tradeoff accepted.

---

## ADR-010 — Universal review request, not gating
**Date:** v2 spec (overrides v1's NPS-gate plan)
**Status:** accepted
**Context:** v1 Phase 11 proposed an NPS-style gate: high scores get a Google review link, low scores get a private feedback form. This is review gating in Google's terms, which is policy-prohibited and risks Painless's GMB profile being suspended.
**Decision:** Every completed customer receives the same end-of-job message containing both: a "leave us a review" link (Google) AND a "had a problem? let us know" link (internal complaints flow). The customer chooses. We don't filter.
**Alternatives considered:**
- Keep NPS gate "borderline acceptable" → rejected per Google's policy text and recent enforcement examples
- Manual selection (rep decides who to ask) → rejected, same gating policy issue dressed differently
- No review request at all → rejected, reviews are critical to local SEO and lead flow
**Consequences:** Review velocity might be marginally slower than gated (because some unhappy customers leave bad reviews). Net long-term win: GMB profile remains in good standing, complaint flow gives early signal on operational issues, and authentic positive reviews dominate over time.

---

## ADR-011 — iOS PWA explicit foreground sync
**Date:** v2 spec
**Status:** accepted
**Context:** Background Sync API is unreliable on iOS Safari/WKWebView. Worker PWA on iPhones could silently lose hours of clock-in data, photos, vehicle checks. Discovering this at scale would be very expensive.
**Decision:** Explicit "Sync now" button always visible in the PWA header. Visible counter showing unsynced item count. Foreground auto-sync on app open. Server-side detection: if a worker has an active clock-in but no time_entries write in 6 hours, push notification "we haven't received your data — please open the app". IndexedDB queue is durable.
**Alternatives considered:**
- Pure background sync, accept iOS losses → rejected
- Mandate Android for crews → not realistic for Painless
- Native iOS app → out of scope, doubles platform cost
**Consequences:** UX has a small "you must remember to sync" friction that pure-background would avoid. We accept it for data integrity. Phase 9 acceptance criteria includes the foreground sync test.

---

## ADR-012 — Scope split into v0.1 / v0.2 / v0.3
**Date:** v2 spec (replaces v1's monolithic 17-phase plan)
**Status:** accepted
**Context:** The v1 plan estimated 13–15 months solo for the full 17 phases. External review correctly noted this is optimistic — realistic full build is 18–24 months. But monolithic builds also delay all value to month 18+.
**Decision:** Three releasable versions:
- **v0.1 (6–9 months):** auth + RLS + customers + jobs kanban + calculator webhook + quote snapshot + basic email + manual invoicing + basic reporting. Painless internal go-live.
- **v0.2 (+4–6 months):** worker PWA + job execution + Xero sync + automated invoicing + capacity calendar + dynamic pricing.
- **v0.3 (+4–6 months):** GoCardless + WhatsApp + full automation engine + affiliate portal + iMVE migration + reporting v2.
**Alternatives considered:**
- Stick with v1 monolithic plan → rejected per review feedback and own re-assessment
- More aggressive v0.1 (include PWA) → rejected, PWA + offline sync is a 2-month module on its own
**Consequences:** Jay starts using the system at month 6–9 instead of month 15+. The system improves with feedback from real use, not from imagination. iMVE migration (v0.3) happens after Painless is already comfortable with the new system in parallel.

---

## ADR-013 — Stage enum canonical in STATE_MACHINE.md
**Date:** v2 spec (resolves v1 inconsistency between MASTER prose and SQL enum)
**Status:** accepted
**Context:** v1 MASTER.md prose used `new_enquiry`, `survey_scheduled`, `quote_accepted`, `invoiced`, `dead_lead`. SQL enum used `lead`, `accepted`, no survey_scheduled, no invoiced, `dead`. Drift = bugs in kanban/automation/reporting.
**Decision:** STATE_MACHINE.md is canonical. SQL enum is the implementation. CI test parses STATE_MACHINE.md and asserts SQL enum matches. Final canonical: 13 stages including `survey_scheduled` and `invoiced` (added), naming reconciled to shorter form (`lead`, `accepted`, `dead`).
**Alternatives considered:**
- MASTER prose as canonical → rejected, prose drifts more than tables
- SQL enum as canonical → rejected, no place for transition rules and required-field metadata
**Consequences:** A single doc owns the lifecycle. Adding a stage requires updating one place + writing a migration + updating the test. Removing a stage requires a data migration script.

---

## ADR-014 — Webhook handler v2 with full hardening
**Date:** v2 spec
**Status:** accepted
**Context:** v1 webhook pattern had HMAC + idempotency only. Missing replay protection, schema versioning, rate limit, per-source rotation. Sufficient for MVP-internal-only, insufficient once GoCardless / Resend / Meta hit Phase 12+.
**Decision:** Five-gate handler: signature (HMAC over `timestamp.version.body`), timestamp freshness (5-min window), schema version pinning (allow-list per source), idempotency (`webhook_events` unique constraint), per-source rate limit. Per-source secret rotation procedure documented. Optional IP allowlist for sources that publish IPs.
**Alternatives considered:**
- Keep v1 minimal pattern, harden later → rejected, "later" never happens
- Use third-party webhook service (Hookdeck, Svix) → adds vendor + cost
**Consequences:** ~200 extra lines in `lib/webhooks/handler.ts`. Worth it. v0.1 only uses one source (painlessremovals) but the structure is in place for v0.2/v0.3 additions.

---

## ADR-015 — Stop documenting ad-hoc; everything significant becomes an ADR
**Date:** v2 spec
**Status:** meta-decision
**Context:** v1 had ~30 implicit decisions scattered across 26 files. Reviewing them required reading all 26 files. Impossible to keep consistent.
**Decision:** This file is the chronological log. Future decisions get a new ADR appended here. Phase docs may *reference* an ADR (`See ADR-007`) but should not restate the decision. Reasoning lives in one place.
**Consequences:** Discipline cost — must remember to write ADRs for new decisions. Mitigated by adding a CLAUDE.md instruction: "before changing architecture in a phase, append an ADR to DECISIONS.md".

---

## ADR-016 — Lead first-response SLA tracking from v0.1
**Date:** v2.1 spec
**Status:** accepted
**Context:** UK removals industry close-rate research consistently shows 4× higher conversion when first response comes within 10 minutes. Painless currently has no visibility into response time — sales reps work from inbox, queue is invisible. A reviewer flagged "SLA timers" as one of the brutal-top-5 features.
**Decision:** Two timestamps on `jobs`: `first_response_due_at` (set on lead create as `enquiry_at + sla_minutes_for_source`) and `first_response_at` (set on first logged contact). Per-source SLA configuration in `settings.sla_minutes_by_source`. Default 15 minutes for paid sources (Google Ads), 30 minutes for organic, 60 minutes for affiliate. Dashboard surfaces overdue leads in real-time. SLA breach is a soft signal (visible warning), not a gate — we don't block actions.
**Alternatives considered:**
- Track via activity_log only → rejected, would require expensive aggregation queries on every dashboard render
- External SLA tool → over-engineered for our scale
- Hardcoded SLA minutes → rejected, different sources need different rules
**Consequences:** Two more columns on jobs table. One indexed query for overdue leads. ~2 days implementation. Net: visibility on the most important top-of-funnel KPI.

---

## ADR-017 — Latest stable + caret-bumped minor/patch dependency policy
**Date:** v2.1 spec
**Status:** accepted
**Context:** "Always latest everything" maximizes breakage. "Pin everything" maximizes security debt. Need a middle path that keeps the app current without surprises.
**Decision:**
- Project starts on **latest stable major** of every dep (Next 16, React 19.2, Tailwind v4, etc.)
- `package.json` uses caret ranges (`^16.2.0`) — minors and patches auto-update within the major
- Renovate runs Mondays 9am, batches related deps, auto-merges patches and low-risk minors after CI green
- Major upgrades (Next 16 → 17, etc.) are deliberate manual events — Renovate opens a PR labeled `framework-major` and waits for human review
- Security alerts run any time, ignore schedule
**Alternatives considered:**
- Pin exact versions → too high security maintenance burden
- Always-latest including major → too much breakage on a solo build
- Manual dep management → slips, creates security debt
**Consequences:** RENOVATE.md spec. `renovate.json` in repo root. Predictable Monday morning Renovate PRs. ~2-3 framework-major events per year, each one a planned half-day.

---

## ADR-018 — Polymorphic document vault from v0.1
**Date:** v2.1 spec
**Status:** accepted
**Context:** Documents (signed quotes, T&Cs, parking permits, insurance certificates) currently scatter across Gmail. Lookup is painful. Customers send documents on a per-job basis but also at customer-relationship level. Need one home for them.
**Decision:** Single `documents` table with polymorphic parent: exactly one of `parent_customer_id`, `parent_job_id`, `parent_quote_id`, `parent_invoice_id` set per row. Constraint enforces exactly-one. RLS scopes via parent — access to parent grants access to document. File metadata in this table; file body in Supabase Storage at `{company_id}/documents/{document_id}/{filename}`.
**Alternatives considered:**
- Separate tables per parent type → 4× duplication, no easy cross-parent queries ("all documents for this customer including all their jobs")
- Single parent FK with discriminator string → looser schema, harder to FK-validate
- Files in S3 / R2 not Supabase Storage → optimization for v0.3, not now
**Consequences:** v0.1 ships with upload + download + per-parent listing. v0.2 adds expiry alerts (insurance, parking permits). v0.3 may add e-sign workflow. SHA256 dedup column lets us catch accidental re-uploads.

---

## ADR-019 — Profit-by-job with manual cost input in v0.1, automation in v0.2
**Date:** v2.1 spec
**Status:** accepted
**Context:** Painless doesn't currently know which jobs are profitable. Long-distance + storage + complications jobs can lose money silently. v0.1 has no PWA, no time tracking, no automated cost capture — but the visibility itself is a brutal-top-5 reviewer ask. Two paths:
- **A:** Schema-only in v0.1 (placeholder dashboard), full population in v0.2 with PWA time tracking
- **B:** Manual admin form in v0.1 (admin enters actual costs after job completion), automation in v0.2
**Decision:** **Option B**. Schema includes `actual_crew_cost_pence`, `actual_van_cost_pence`, `passthrough_costs_pence`, `profit_review_status` ('pending'/'reviewed'/'finalized'). Profit review form pre-fills from estimates; admin overrides. Dashboard surfaces revenue, cost, profit, margin% per job and aggregate. v0.2 PWA time tracking will pre-fill 90% accuracy; admin reviews. v0.3 auto-finalize on close-match.
**Alternatives considered:**
- **A** (schema-only): rejected per user choice. Reasoning: visibility at v0.1 launch is worth 4 days of UI work and a manual workflow; deferring to v0.2 means 6+ months of flying blind on profit signals.
- Capture from Xero costs only → Xero only has expenses booked against the job (rare), not crew labor allocation
**Consequences:** Form + dashboard work in Phase 06b. Admin discipline required to fill the form (banner reminder on home page surfaces pending queue). Manual error possible — finalize lock prevents drift after sign-off.

---

## ADR-020 — Postgres pg_trgm for global search; no external search service
**Date:** v2.1 spec
**Status:** accepted
**Context:** Cmd+K global search across customers/jobs/quotes/invoices/phone-numbers. Options range from `LIKE %x%` (slow) to dedicated search service (Algolia, Meilisearch — money + complexity).
**Decision:** PostgreSQL `pg_trgm` extension with GIN trigram indexes on the searched columns. RLS-scoped automatically (every query passes through tenant filter). Target <100ms p95 across realistic 100k-row volumes.
**Alternatives considered:**
- Algolia / Meilisearch → external service, sync complexity, cost (~$50/month minimum), and a privacy data-residency question (PII leaving Supabase)
- Postgres full-text search (tsvector) → fine for English documents but worse for short identifiers and phone numbers; pg_trgm handles fuzzy substring matching better
- Plain `ILIKE %x%` → no index help on prefix queries, falls over at 50k rows
**Consequences:** `create extension pg_trgm` in Phase 02. ~5 indexed columns across 4 tables. Search Server Action in Phase 06b. No external dependency. Multi-tenant safe by RLS.

---

## ADR-021 — Export auditing + rate limiting in a dedicated table, not activity_log
**Date:** 2026-05-30
**Status:** accepted
**Context:** SECURITY_MODEL.md T4 (insider data exfiltration) requires bulk read/export operations to be rate-limited and audit-logged with row counts. The CSV export routes (Phase 06b §8) initially had neither. The obvious sink, `activity_log`, is the wrong fit: Phase 03 RLS does `revoke insert ... from authenticated` (it is written only by the SECURITY DEFINER mutation trigger), and its `entity_id uuid not null` column has no meaning for a list export, which is a read with no single entity.
**Decision:** (1) A reusable fixed-window rate limiter `rateLimitCheck(key, { windowSec, maxRequests })` backed by Cloudflare KV (`RATE_LIMIT_KV`), degrading open when unbound — this is the same helper SECURITY_MODEL Gate 5 already references for webhook overflow. Exports are capped at 10/user/hour. (2) A dedicated `data_export_log` table records each export (actor, resource, filters, row_count, format), mirroring the existing `integration_credential_access_log` precedent of keeping non-mutation audit events out of `activity_log`. Rows are insert-only for app roles (no update/delete) so the trail cannot be rewritten. The audit write is best-effort: it never blocks a legitimate export.
**Alternatives considered:**
- Insert export events into `activity_log` → blocked by the `authenticated` insert revoke, and pollutes the entity-keyed mutation trail with entity-less read events
- A DB trigger for exports → exports are app-level reads, not table mutations, so no trigger can observe them
- In-memory / per-instance rate limiting → useless across Cloudflare's distributed isolates; KV is the shared store
**Consequences:** New `RATE_LIMIT_KV` namespace to provision (helper degrades open until then). New `data_export_log` table + migration `00000000000035`. When the Worker PWA and other bulk-read surfaces land, they reuse `rateLimitCheck` and `recordExport`. Full DLP (anomaly detection on export volume) remains post-v1 per T4.

---

## ADR-022 — Capacity bands: daily granularity, utilisation thresholds, estimated_hours basis
**Date:** 2026-06-01
**Status:** accepted
**Context:** Phase 07 needs a capacity model to drive the traffic-light calendar (and later dynamic pricing). The spec left three things open: daily vs AM/PM granularity, the utilisation→band thresholds, and the committed-hours basis (the schema has `jobs.estimated_hours` but no `crew_size`, despite the spec's `estimated_hours * crew_size`).
**Decision:** (1) **Daily** granularity for v1 (the spec's own recommendation; AM/PM is Phase 14+). (2) Committed load per day = sum of `estimated_hours` for jobs whose `move_date` falls on that day and whose stage is `confirmed` or `in_progress` — no `crew_size` factor exists yet, so estimated_hours is the man-hours proxy. (3) Bands by utilisation = committed / daily-max: **green** < 60%, **yellow** 60–90%, **red** ≥ 90%; **closed** only via an admin override. The daily-max starts as a module constant (`DEFAULT_DAILY_CAPACITY_HOURS`) and moves to `settings` in a later increment. A `capacity_overrides` row (forced_band) always wins over the derived band.
**Alternatives considered:**
- AM/PM split → real but doubles the model and UI; deferred per spec.
- Crew-weighted man-hours → blocked: no `crew_size` column until Phase 08 resources; estimated_hours is the available signal.
- Storing the daily max in settings now → settings has no capacity field; adding one is its own increment, so a constant unblocks the calendar first.
**Consequences:** The band reflects job-hours, not crew-weighted man-hours, until Phase 08 adds crew sizing. Thresholds live in `lib/capacity/band.ts` (pure, tested). KV broadcast, the public availability page, the nightly cron and quote modulation are later Phase-07 increments; this one ships the internal calendar only.

---

## ADR-023 — Storage container status is derived from its rental lifecycle (except maintenance)
**Date:** 2026-06-01
**Status:** accepted
**Context:** Phase 08 §Storage gives `storage_containers` a `status` enum (available/reserved/occupied/maintenance) AND a `storage_rentals` table with its own status (pending/active/terminated). The spec's "Storage occupancy" section says the container status is *derived* from rentals, but the column physically exists, so the two must be reconciled without drift. `maintenance` has no corresponding rental concept — it's an operational flag.
**Decision:** The container `status` column is the materialised projection of its current rental, written transactionally by the rental actions, never edited by hand once rentals are in play: reserving a rental (pending) sets the container `reserved`; activating it (active) sets `occupied`; terminating it (terminated, `end_date` stamped) returns the container to `available`. `maintenance` stays a manual admin flag set on the container directly (Slice A edit) and is the one status not driven by rentals. A rental may only be reserved against an `available` container — `occupied`/`reserved`/`maintenance` containers are blocked. The allowed rental transitions (pending→active|terminated, active→terminated, terminated→∅) and the rental→container-status mapping live in a pure, tested module (`lib/storage/rental-lifecycle.ts`).
**Alternatives considered:**
- Drop the container `status` column and compute occupancy purely from rentals on every read → cleaner in theory, but the column is in the shipped schema, the Slice-A grid already reads it, and a stored projection keeps the grid/occupancy queries single-table and fast.
- A DB trigger to sync container status from rentals → more "correct" but hides the state machine in SQL; the app-layer action is visible, testable, and matches how the rest of the codebase mutates (Server Actions + optimistic concurrency).
**Consequences:** The sync is application-enforced, so any future direct writes to `storage_rentals` outside the actions could desync the projection (acceptable: all writes go through the actions today). Maintenance and rentals can conflict — a container flagged `maintenance` mid-rental keeps its rental rows but shows `maintenance`; resolving that interplay (e.g. blocking maintenance while occupied) is deferred. Occupancy (ADR-less, in `lib/storage/occupancy.ts`) continues to count `occupied` containers, so it now reflects active rentals automatically.

---

## ADR-024 — Comms automation: event triggers + dwell-guarded no-response follow-ups
**Date:** 2026-06-03
**Status:** accepted
**Context:** Migrating Jay's iMVE transactional email templates (`EMAIL_TEMPLATES.md`) into the Phase 13 Comms Hub. The engine only fires on `job.stage_changed`, but several templates are event-driven (deposit/final invoice + receipt) or time-delayed "no reply yet" follow-ups (the quote follow-up chain), neither of which is a stage change. The automation tables are already schemaless on intent: `automation_rules.trigger_event` is free text and `trigger_filters`/`action_config` are `jsonb`.
**Decision:** Generalise the engine rather than add columns. (1) **New `trigger_event` values** — `invoice.created`, `payment.recorded`, `job.created` — enqueued best-effort from the existing Phase 12 mutations and the job-create path, mirroring `enqueueStageAutomation` (a failure here never breaks the mutation, per the existing pattern). (2) The matcher generalises from `matchStageRules` to `matchRules(rules, event, ctx)`, checking every key present in `trigger_filters` (now including `service_type` — see ADR-025) against a context object. (3) **No-response follow-ups** reuse `job.stage_changed` (to=`quoted`) with `delay_seconds`, plus a send-time **dwell-guard**: `action_config.requires_stage` is re-checked against the job's *current* stage when the queued row comes due; if the job has moved on (customer replied/accepted/declined), the row is finished as `skipped` with reason `superseded`. This auto-cancels the chain without a separate cancellation mechanism.
**Alternatives considered:**
- A dedicated `scheduled_followups` table with explicit cancel → more moving parts; the dwell-guard reuses `automation_queue` and the per-minute cron already in place.
- New typed columns on `automation_rules` for event/filter kinds → the `jsonb` columns already carry this; typing them is churn without payoff at single-tenant scale.
- A new cron for follow-ups → unnecessary; `automation-queue` (`* * * * *`) already drains due rows.
**Consequences:** Trigger semantics live in `action_config`/`trigger_filters` conventions, not the schema, so they must be documented (STATE_MACHINE.md §automation hooks) and enforced in the pure matcher + cron guard. The dwell-guard makes "send unless superseded" the contract for any delayed rule. Attachments are still out of scope (PDF generation infra-gated) — invoice/receipt emails send text + portal link until Browser Rendering lands.

---

## ADR-025 — `jobs.service_type` discriminates removals / waste-clearance / storage
**Date:** 2026-06-03
**Status:** accepted
**Context:** Both the removals "Quotation" and the "Waste Clearance quote" templates fire on the `quoted` stage, but the job row has no field distinguishing the service line, so the engine can't pick the right copy. Waste clearance is a genuinely different product (ethical-disposal messaging, different signature).
**Decision:** Add `jobs.service_type text not null default 'removal' check (service_type in ('removal','waste_clearance','storage'))` (migration `00000000000044`). It becomes a `trigger_filters.service_type` key the generalised matcher (ADR-024) checks, so `quoted` sends the removals quote for `removal` jobs and the clearance quote for `waste_clearance` jobs. `storage` is included for completeness (storage-only engagements) though storage billing remains its own flow.
**Alternatives considered:**
- Reuse `acquisition_source` or a tag → overloads an unrelated field; service line is a first-class attribute of the job.
- A separate `job_types` lookup table → over-engineered for three fixed values at single-tenant scale; an enum-style check constraint mirrors how the codebase models other small closed sets.
**Consequences:** A spine-table (`jobs`) column, so `database.types.ts` regenerates and existing job-create paths default to `removal`. Future service lines extend the check constraint via migration. The kanban/job UI gains an optional service-type selector in a later pass (not required for the automation wiring).

---

## ADR-026 — `jobs.arrival_window` free-text crew arrival slot
**Date:** 2026-06-03
**Status:** accepted
**Context:** The "Removal confirmation" template renders `{{move_time}}` ("our team will aim to be with you for …"), but `jobs.move_date` is a single `timestamptz` representing the move day, not a customer-facing arrival window, and Painless quotes a *range* ("8:00–9:00") rather than an exact time.
**Decision:** Add `jobs.arrival_window text` (nullable) holding the human arrival slot as entered by the office (e.g. "8:00–9:00", "AM"). `{{move_time}}` renders this field; when blank it renders empty (the sentence degrades gracefully). Kept as free text deliberately — it's display copy, not a scheduling primitive.
**Alternatives considered:**
- Derive a time from `move_date`'s timestamp → `move_date` carries the day, not a committed arrival time; deriving would surface a misleading exact minute.
- Structured `arrival_from`/`arrival_to` times → premature; the value is purely presentational today and ranges/format vary ("AM", "first drop").
**Consequences:** A nullable spine-table column (`database.types.ts` regenerates). `{{move_time}}` is empty until the office fills the window. If arrival windows later drive scheduling/capacity, this migrates to structured fields via a follow-up ADR.

---

## ADR-027 — Branding source of truth is the `settings` row, merged at render
**Date:** 2026-06-03
**Status:** accepted
**Context:** Phase 18 introduces customer-facing branding (company name, brand colour, logo) that must appear on documents like the quote print-out, and later on invoices/receipts/storage docs. The values must be tenant-editable, not baked into env or the deploy.
**Decision:** The per-tenant `settings` row (already has `brand_color`, `logo_url`) plus `companies.name` are the single source of truth. A pure `resolveBranding()` helper (`src/lib/settings/branding.ts`) merges a possibly-absent source with safe defaults (`DEFAULT_BRAND_COLOR`, `DEFAULT_COMPANY_NAME`) at render time; document pages read it via `getBrandingByCompanyId()` (admin client for anonymous/token-gated pages). No new columns — Phase 18 edits existing ones only. The settings update uses optimistic concurrency on `settings.version`; a `version=0` form value is the "no row yet" sentinel that inserts at version 1.
**Alternatives considered:**
- Branding in env / build-time config → not tenant-editable, breaks multi-tenancy and forces a deploy to change a logo.
- New `branding` table → unnecessary; `settings` already carries `brand_color`/`logo_url` and is 1:1 with the tenant.
- Storing company name on `settings` too → duplicates `companies.name`; the tenant display name already lives there.
**Consequences:** Document headers depend on a resolve step rather than raw row values, so a malformed/blank brand colour degrades to the default instead of rendering broken markup. Company name edits touch the `companies` spine table (no `version` column there — last-write-wins on name only; settings keep the optimistic lock). The same helper is the seam the PDF-render work (🔒 Browser Rendering binding) and future document designers (Phase 25) build on.

---

## ADR-028 — Job tasks are a flat, lightweight checklist; notes split via existing `category`
**Date:** 2026-06-03
**Status:** accepted
**Context:** Phase 19 brings the job page closer to the iMVE "Workflow" view, which has a Task Management checklist plus separate Admin / Staff note timelines. We must decide how rich tasks are, and how to model the notes split.
**Decision:** Two parts. (1) **Tasks** are a new `job_tasks` table (migration 45) but a *flat* checklist — title, done, optional due date, optional assignee, `sort_order` — with **no dependencies, sub-tasks, or assignment workflow**. Mutations are add / toggle / delete; pure helpers (`completeness`, `nextSortOrder`) hold the logic. (2) **Notes split** needs **no schema change**: the existing `notes.category` (admin/staff/customer_visible, Phase 02) becomes the author-chosen audience. `AddJobNoteSchema` gains an optional `category` (backward-compatible with the legacy `is_customer_visible` toggle, which stays in sync); the panel groups by category via a pure `groupNotesByCategory`. Soft-deleted task rows follow the same RLS Pattern-1 (admin-only visibility) as the rest of the spine.
**Alternatives considered:**
- Rich tasks (deps, recurring, per-task assignment workflow) → over-scoped vs iMVE; defer until a real need.
- A new `note_audience` column or separate staff-notes table → duplicates `category`, which already has exactly the three buckets.
- Drop `is_customer_visible` and make `category` the sole truth now → would touch the public acceptance read and Phase 06b/13b code; kept both in sync instead for a non-breaking change.
**Consequences:** `job_tasks` adds one tenant table + its RLS policy (replicated inline since the migration-03 Section E loop predates it) and a `set_updated_at` trigger (the first table to actually attach it — elsewhere `updated_at` is set in app code). `sort_order`/`assigned_to_id`/`due_date` columns exist but their reorder/assignment UIs are deferred (no dead code: add/toggle/delete only). Notes now show three timelines; legacy rows with null/old category normalise to 'admin'.

---

## ADR-029 — Dispatcher board is read-only over a pure assembler
**Date:** 2026-06-03
**Status:** accepted
**Context:** Phase 20 rebuilds the iMVE per-staff / per-vehicle daily swimlane board. The data already exists in `job_assignments` (worker_id, vehicle_id, date, role, times). The open questions: is the board editable, and where does the grid logic live.
**Decision:** The board is **read-only in v1** — it visualises existing assignments; all edits stay on the job page / rota (which already have the assign form + conflict checks). The grid is built by a **pure assembler** `src/lib/dispatch/board.ts` (`assembleBoard`) that takes a flat assignment list + lane options + a date window and returns staff-or-vehicle swimlanes, fully unit-tested with no I/O. Empty lanes from the option list are preserved; a lane that exists only in the data (e.g. a now-inactive worker with a live assignment) is backfilled so nothing is silently dropped. The follow-up-call / awaiting-payment badges derive **purely from job stage** (`deriveBadges`: quoted → follow-up; completed|invoiced → awaiting payment), so no extra query.
**Alternatives considered:**
- Drag-to-reassign in v1 → needs the rota's conflict/capacity checks replicated in a DnD client; deferred to a later phase (backlog).
- Assemble in the query / page → not unit-testable; the swimlane grouping + windowing is exactly the kind of logic that belongs in a pure module (cf. `rota/conflicts`, `worker-cron/dispatch`).
**Consequences:** A new read-only route `/dashboard/dispatch` (manager+) with no migration. Badge semantics are a documented stage map — if Painless wants different triggers (e.g. follow-up from a callbacks table), it changes one constant set. Drag-to-reassign and per-task vehicle reallocation remain backlog items.

---

## ADR-030 — Visual analytics: dependency-free inline SVG, stage-weighted projected revenue
**Date:** 2026-06-03
**Status:** accepted
**Context:** Phase 21 rebuilds the iMVE Performance screen as a consolidated visual dashboard (jobs by type/status/source, quote conversion by staff, revenue + projected revenue). Two questions: how to render charts, and how to define "projected revenue".
**Decision:** (1) **No chart library.** Charts are dependency-free presentational server components — a donut via SVG `stroke-dasharray` (`components/charts/donut.tsx`, fixed `CHART_COLORS` palette) and horizontal bars via CSS widths (`components/charts/bar.tsx`). Zero new deps, no client JS, consistent with the existing text-only report pages. (2) **Projected revenue** = expected value of the open pipeline: each non-terminal, unpaid job's quote value × a stage win-probability from a documented constant map `WIN_PROBABILITY_BY_STAGE` (lead 0.05 → invoiced 0.99; paid + terminal stages absent → contribute nothing, since paid is already realised and terminal is lost). Aggregators are pure (`lib/reports/analytics.ts`), reading one `listAnalyticsJobs` cohort. The page reuses the existing `buildStorageReport` for the Storage toggle.
**Alternatives considered:**
- A chart library (Recharts/Chart.js) → new dependency + client bundle for what is a handful of static shapes; rejected per the project's lean-deps stance.
- Projected revenue = sum of all open quote values (unweighted) → overstates; a quoted lead is not worth the same as an accepted one.
- Probability from historical per-stage conversion → better long-term, but needs a trained baseline; the constant map is the documented v1 that can be swapped for a data-driven one later.
**Consequences:** Charts are intentionally simple (no tooltips/animation). The projection is only as good as the constant weights — they live in one exported map so Painless can tune them, and a future phase can replace them with measured conversion rates without touching the page. New route `/dashboard/reports/analytics` (manager+), no migration, no deps.

---

## ADR-031 — Appointments are a thin diary overlay, distinct from assignments and capacity
**Date:** 2026-06-03
**Status:** accepted
**Context:** Phase 22 adds the iMVE Calendar Overview (general appointments + staff holidays). The system already has `job_assignments` (crew/vehicle ops scheduling) and capacity bands (availability). The risk is conflating these three.
**Decision:** A new `appointments` table is a **thin diary entry** — title, category, start/end, optional links to a job/customer/assignee — explicitly *not* a scheduling primitive: it does not allocate crew or consume capacity. `staff_holidays` is a separate worker-time-off table. Both follow the standard spine (RLS Pattern-1 inline, `set_updated_at`, soft delete, version). The calendar UI is month/week/day over a **pure window+grouping module** `lib/calendar/grid.ts` (`viewDays`, `groupAppointmentsByDay`, `holidayCoversDate`, `appointmentsOverlap`), fully unit-tested. Holidays are surfaced read-only on the dispatcher board (staff lanes show an "off" marker); deeper capacity integration is deferred.
**Alternatives considered:**
- Reuse `job_assignments` for appointments → pollutes ops scheduling with non-crew diary items and forces a fake worker/job on every entry.
- Model holidays as `worker_availability` rows → that table is the capacity-planning surface; holidays are a distinct, reason-bearing concept and belong on their own table that *feeds* availability.
- Hour-grid week/day rendering → deferred; the agenda-list week/day view is lean and faithful enough for v1.
**Consequences:** Three scheduling-ish surfaces now coexist with clear roles (appointments = diary, assignments = ops, capacity = availability). Holidays are shown on the dispatcher board but do **not yet** subtract from capacity bands — a documented follow-up. Appointment create/delete only in v1 (edit deferred); week/day are agenda lists, not hour grids.

---

## ADR-032 — Message inbox is read-only over stored messages; threading by thread_id
**Date:** 2026-06-03
**Status:** accepted
**Context:** Phase 23 adds the iMVE Messages nav. The `messages` table already records every email/SMS/WhatsApp (channel, direction, thread_id, in_reply_to, subject/body, sent/opened/replied timestamps), but there is no inbound ingestion or manual-compose send yet (both infra-gated, Phase 13 parts).
**Decision:** The inbox is **read-only v1** — it lists and threads what is already stored; it does not compose or receive. Threading is by `thread_id`, falling back to the message's own id (a singleton) when unthreaded — most rows today are unthreaded outbound automation sends. Grouping/sorting/preview live in a pure module `lib/messages/thread.ts` (`groupThreads`, `sortThreadMessages`, `threadKey`), unit-tested. The detail view reloads a thread from a representative message's `thread_id`. `messages` has no `deleted_at`, so reads carry no soft-delete filter.
**Alternatives considered:**
- Group by customer instead of thread_id → over-merges distinct conversations; thread_id is the table's intended key and inbound ingestion will populate it.
- Build compose/reply now → depends on channel send infra (Resend inbound, Tamar/WhatsApp) that is gated; replies stay on the job page / automation for now.
- Wait for inbound infra before shipping any inbox → the stored history is already useful read-only (audit of what went out, per-customer/job linkage).
**Consequences:** Today the inbox reads mostly as a flat, recency-sorted list of outbound sends (few threads, no inbound), which is honest given the data. When inbound ingestion lands and sets `thread_id`/`direction='inbound'`, the same pure grouping produces real two-sided threads with the "needs reply" badge — no rework. Compose/live reply remain a later infra-gated phase.

---

## ADR-033 — Storage CSV import is validate-then-commit with a preview; no silent row drops
**Date:** 2026-06-03
**Status:** accepted
**Context:** Phase 24 adds the iMVE storage "Import CSV" and container "Duplicate". The office prepares container lists in a spreadsheet; importing them must be safe and predictable, and there is no CSV-parsing code yet (the export module is write-only).
**Decision:** A hand-rolled RFC-4180 parser (`lib/storage/csv-import.ts`, the inverse of the export module's `csvField`) feeds a pure `buildContainerImport` that validates every data row against the existing `StorageContainerSchema`. The flow is **preview then commit**: the same Server Action runs in `preview` mode (returns valid count + per-line errors + skipped duplicates) and `commit` mode (inserts the valid rows). **No silent drops** — rejected rows are reported by line number, and duplicates (existing site codes or repeats within the file) are listed, not dropped quietly. A blank monthly rate is an error, not a coerced 0. Duplicate-container clones the source as a fresh `available` unit with a `-COPY` code suffix.
**Alternatives considered:**
- A CSV library (papaparse) → unnecessary dependency for a small, well-specified format; the export module already hand-rolls the write side.
- Direct import without preview → unsafe; the office can't see what a paste will do before it commits.
- Silently skipping bad/duplicate rows → hides data-entry mistakes; explicit per-line reporting is the point.
**Consequences:** Import is paste-CSV (textarea), not file-upload — adequate and avoids the storage-bucket dependency. The parser is reused-validation, so import rules can never drift from the create form. Site-plan image upload stays 🔒 (needs a storage bucket). `-COPY` collisions surface a rename prompt rather than auto-incrementing.

---

## Open decisions (not yet resolved — pending input)

These are flagged in relevant phase docs. Each becomes an ADR once decided.

- **OD-1** — Tamar Telecom Partner API access vs email parsing fallback (Phase 13 prep)
- **OD-2** — Vehicle check form: keep public on painlessremovals.com or move to PWA only (Phase 9 prep)
- **OD-3** — Liveswitch v0.2 scope: upload-only or full live SDK integration (Phase 10 prep)
- **OD-4** — iMVE migration scope: full historical or active 12 months only (Phase 17 / v0.3 prep). Recommendation: 12 months active + read-only archive.
- **OD-5** — 2FA for admin/super_admin from v0.1 or v0.2 (Phase 1 prep). Recommendation: v0.2 mandatory, v0.1 optional.
- **OD-6** — Worker PWA session length: 7 days or match office (30 days). Recommendation: 7 days.
