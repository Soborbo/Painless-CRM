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

## Open decisions (not yet resolved — pending input)

These are flagged in relevant phase docs. Each becomes an ADR once decided.

- **OD-1** — Tamar Telecom Partner API access vs email parsing fallback (Phase 13 prep)
- **OD-2** — Vehicle check form: keep public on painlessremovals.com or move to PWA only (Phase 9 prep)
- **OD-3** — Liveswitch v0.2 scope: upload-only or full live SDK integration (Phase 10 prep)
- **OD-4** — iMVE migration scope: full historical or active 12 months only (Phase 17 / v0.3 prep). Recommendation: 12 months active + read-only archive.
- **OD-5** — 2FA for admin/super_admin from v0.1 or v0.2 (Phase 1 prep). Recommendation: v0.2 mandatory, v0.1 optional.
- **OD-6** — Worker PWA session length: 7 days or match office (30 days). Recommendation: 7 days.
