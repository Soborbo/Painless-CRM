# Painless CRM — Build Spec Package (v2.1)

**Owner:** Soborbo Ltd · Laszlo
**Client:** Painless Removals (Bristol, est. 1978) · Jay Newton
**Purpose:** Custom operations CRM to replace iMVE, integrated with `painlessremovals.com`
**Build method:** Solo + Claude Code (vibe coded)
**Realistic timeline:** 14–21 months across three releases (v0.1 / v0.2 / v0.3 — see scope split below)
**Stack:** Next.js 16.2 · React 19.2 · Supabase Pro · Cloudflare Workers · TypeScript · Tailwind v4 · Zod

> **Spec version 2.1.** Schema sync sweep (deleted_at + version on 21 tables, jobs stage timestamps, SLA + profit fields, review/signoff schema sync), Phase 01 audit trigger fixed to defensive pattern, latest stable version pin, 10 new v0.1 features bundled in new Phase 06b, 5 new ADRs (016 SLA, 017 dependency policy, 018 documents, 019 profit-by-job, 020 search). v2 backups remain available; v1 backups at `references-v1/`, `phases-v1/`, `MASTER.v1.md`, `INDEX.v1.md`, `CLAUDE.v1.md`.

> **Verziózás-jelölés (read carefully):**
> - **v0.1 = build spec** — fully detailed, ready for Claude Code to implement
> - **v0.2 = roadmap** — skeletons with key decisions; expand 1 month before each phase starts
> - **v0.3 = vision** — sketches; treat as "what we're heading toward", not implementable yet

---

## How to read this package

Read in this order:

1. **`MASTER.md`** — architecture overview, stack, domain model, multi-tenancy contract, 8 user roles, scope split, build doctrine.
2. **`DECISIONS.md`** — chronological ADR log (20 ADRs, OD-1 to OD-6 open). The "why" for every architectural choice.
3. **`STATE_MACHINE.md`** — canonical job lifecycle. Stages, transitions, required fields, automation hooks. SQL enum and UI both derive from this.
4. **`SCHEMA_CONTRACT.md`** — per-table doctrine matrix (scoped/mutable/soft-del/version/audit/RLS). New in v2.1.
5. **`SECURITY_MODEL.md`** — threat model, multi-tenant isolation contract, webhook hardening, PII contract, key management.
6. **`INTEGRATION_CONTRACTS.md`** — per-provider contracts (painlessremovals webhooks, Xero, GoCardless, Google Ads, Meta, Resend, Tamar, Liveswitch, Anthropic).
7. **`RENOVATE.md`** — dependency update strategy. New in v2.1.
8. **`CLAUDE.md`** — Claude Code working agreement. Drop into project root.
9. **`phases/00-foundation.md`** — start here. Cloudflare smoke-test gate. **Do not start phase 01 until phase 00 acceptance criteria pass.**
10. Each subsequent phase, in order, scoped to the appropriate version. **Sequential, not parallel.**
11. **`references/`** — pattern library. Open when a phase says "see references/X". Don't read top-to-bottom.

---

## Package contents

```
painless-crm-spec/
├── INDEX.md                          ← you are here
├── MASTER.md                         ← architecture + scope-split + phase index
├── CLAUDE.md                         ← drop into project root
├── DECISIONS.md                      ← ADR log (20 ADRs, OD-1 to OD-6 open)
├── STATE_MACHINE.md                  ← canonical job lifecycle
├── SCHEMA_CONTRACT.md                ← per-table doctrine matrix (v2.1)
├── SECURITY_MODEL.md                 ← threats, RLS contract, webhook hardening, PII
├── INTEGRATION_CONTRACTS.md          ← per-provider integration spec
├── ERROR_HANDLING.md                 ← error code namespace, retry policy, Sentry rules
├── RENOVATE.md                       ← dependency update strategy (v2.1)
├── MIGRATION_MAPPING.md              ← iMVE → painless-crm field mapping (skeleton)
├── DATA_DICTIONARY.md                ← every field with explanation (skeleton)
├── GAP_ANALYSIS.md                   ← iMVE vs painless-crm parity audit + Phase 18+ roadmap (2026-06)
├── phases/
│   ├── 00-foundation.md              ← v0.1 GATE — Cloudflare smoke test
│   ├── 01-auth-multitenant.md        ← v0.1 BUILD SPEC
│   ├── 02-database-schema.md         ← v0.1 BUILD SPEC
│   ├── 03-customer-360.md            ← v0.1 BUILD SPEC
│   ├── 04-jobs-pipeline.md           ← v0.1 BUILD SPEC (STATE_MACHINE.md canonical)
│   ├── 05-pricing-engine.md          ← v0.1 BUILD SPEC (calculator webhook + KV)
│   ├── 06-quote-builder.md           ← v0.1 BUILD SPEC (PDF, public acceptance)
│   ├── 06b-v01-light.md              ← v0.1 BUILD SPEC (NEW: SLA, profit, search, timeline, requote, vault, exports, owner home)
│   ├── 07-capacity-pricing.md        ← v0.2 ROADMAP (dynamic margin, capacity calendar)
│   ├── 08-resource-management.md     ← v0.2 ROADMAP (vehicles, storage, workers, rota)
│   ├── 09-worker-pwa.md              ← v0.2 ROADMAP (iOS-aware foreground sync)
│   ├── 10-job-execution.md           ← v0.2 ROADMAP (job sheets, surveys)
│   ├── 11-customer-signoff.md        ← v0.2 ROADMAP (universal review request)
│   ├── 12-invoicing-payments.md      ← v0.2 ROADMAP (Xero) + v0.3 VISION (GoCardless DD)
│   ├── 13-communications-hub.md      ← v0.3 VISION (Email + SMS + WhatsApp + Tamar)
│   ├── 14-reporting-analytics.md     ← v0.3 VISION (dashboards v2, attribution, ad sync)
│   ├── 15-notifications-collab.md    ← v0.3 VISION (push, in-app, @mentions)
│   ├── 16-affiliate-quality.md       ← v0.3 VISION (affiliate codes, insurance/damages)
│   └── 17-migration-golive.md        ← v0.3 VISION (iMVE import, staged rollout)
├── references/
│   ├── schema.sql                    ← full annotated Postgres schema (v2.1)
│   ├── types.ts                      ← TypeScript domain types
│   ├── rls-patterns.md               ← RLS policy templates
│   ├── kv-broadcast.md               ← Cloudflare KV write/read pattern
│   ├── audit-log.md                  ← Postgres audit trigger pattern
│   └── webhook-pattern.md            ← inbound webhook handler v2 (hardened)
├── TEST_FIXTURES/
│   ├── README.md                     ← fixture conventions
│   ├── jay-v42-pricing-scenarios.json   ← 17 Jay scenarios for pricing CI
│   └── webhook-fixtures.json            ← v2.1 — signature/timestamp/version/replay/rate-limit cases
├── references-v1/                    ← v1 backup (do not edit)
├── phases-v1/                        ← v1 backup (do not edit)
├── MASTER.v1.md / INDEX.v1.md / CLAUDE.v1.md  ← v1 backups
```

---

## Scope split: v0.1 / v0.2 / v0.3

The full 17-phase build is 14–21 months solo. To get value to Jay quickly, the build is split into three releasable versions. Each is internally complete and deployable.

### v0.1 — Internal CRM (months 1–10)
**Goal:** Painless internal go-live. Replace iMVE for lead capture, kanban, quoting, manual invoicing tracking, owner dashboard, profit visibility, and SLA monitoring. Office-only — no PWA, no automation engine, no DD.

Phases included:
- 00 Foundation (smoke-test gate)
- 01 Auth + RLS + multi-tenant
- 02 Database schema
- 03 Customer 360
- 04 Jobs pipeline (kanban, full STATE_MACHINE)
- 05 Pricing engine + calculator webhook
- 06 Quote builder + public acceptance
- **06b Light modules (NEW v2.1)** — SLA timer, profit-by-job (manual input), global Cmd+K search, manual call log, job timeline, requote one-click, document vault, CSV/Excel exports, internal vs customer-visible notes, owner daily home
- (light) basic email via Resend
- (light) basic reporting v1

Acceptance: Jay's whole sales team uses the system for lead-to-quote-to-acceptance. Calculator quotes flow into the CRM via webhooks. SLA dashboard tells Jay which leads need urgent response. Profit dashboard shows which jobs make money. Manual invoice status updates work. iMVE remains source of truth for historical jobs (read-only).

### v0.2 — Operations + Xero (months 10–15)
**Goal:** Worker PWA, automated invoicing, dynamic pricing, capacity calendar.

Phases included:
- 07 Capacity + pricing
- 08 Resource management (vehicles, storage, workers, rota)
- 09 Worker PWA (iOS-aware sync)
- 10 Job execution (sheets, video surveys)
- 11 Customer sign-off + universal review request
- 12 Invoicing-payments (Xero portion)

Acceptance: Crews work fully from the PWA, invoices flow to Xero, customers self-serve sign-off and reviews.

### v0.3 — Full automation + migration (months 16–21)
**Goal:** GoCardless DD, WhatsApp, full automation engine, affiliate portal, iMVE migration, advanced reporting.

Phases included:
- 12 (cont.) GoCardless DD + dunning
- 13 Communications hub (WhatsApp, SMS, Tamar)
- 14 Reporting v2 + ad attribution
- 15 Notifications + collaboration
- 16 Affiliate + quality
- 17 iMVE migration + final cutover

Acceptance: iMVE is fully retired. Painless runs entirely on the new CRM.

---

## Build doctrine (one-page summary)

1. **Sequential phases, not parallel.** Each phase has acceptance criteria. Don't start the next until current passes.
2. **Phase 00 is a hard gate.** If Cloudflare Workers can't run Supabase Realtime, PDF generation, image processing, or Excel export reliably, switch CRM to Vercel before phase 01.
3. **Multi-tenant from day 1.** `company_id UUID NOT NULL` everywhere. RLS via `current_user_company_id()`. Painless = `'00000000-0000-0000-0000-000000000001'`. (See SECURITY_MODEL.md §2.)
4. **No data is ever hard-deleted.** Soft delete via `deleted_at`. RLS hides deleted rows.
5. **All mutations audited.** Defensive trigger on every business table — see ADR-007 and `references/audit-log.md`.
6. **Pricing engine is single source of truth.** CRM master, calculator reads from KV. Quote freeze via `pricing_versions` snapshot (ADR-005).
7. **Jay's 17 v4.2 fixtures are sacred.** Any pricing change must keep all 17 within ±15%. Tests in `TEST_FIXTURES/jay-v42-pricing-scenarios.json`, run in both repos.
8. **Workers are contractors.** No PAYE, no HMRC RTI (ADR-006).
9. **PII strict scrub** in Sentry, logs, AI calls. See SECURITY_MODEL.md §6.
10. **Quote freeze.** Once issued, price holds for `quote_validity_days` regardless of config changes.
11. **Job-centric domain.** Jobs table is the spine. "Lead" = `jobs.stage='lead'` (ADR-001).
12. **Vendor-neutral core.** Cloudflare-specific code in adapter modules. CRM portable to Vercel if smoke-test forces switch.
13. **STATE_MACHINE.md is law.** SQL enum, kanban, automation, reporting all derive from it. CI compliance test enforces (ADR-013).
14. **Webhook handler v2 from day 1.** All inbound webhooks use the 5-gate hardened pattern (ADR-014).
15. **Universal review request, no gating.** Every paid customer gets the same email containing both review + complaint links (ADR-010).
16. **iOS PWA: foreground sync mandatory.** No background-sync-only flows on iOS (ADR-011).
17. **Discipline: every architectural change creates an ADR.** No silent decisions.

---

## Stack pin (v0.1 baseline — see RENOVATE.md)

Project starts on **latest stable major** of every dep. Caret ranges (`^x.y.z`) auto-update minors and patches. Major upgrades are deliberate manual events, never auto-merged.

```json
{
  "dependencies": {
    "next": "^16.2.0",
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "@supabase/supabase-js": "^2.x",
    "@supabase/ssr": "^0.x",
    "@opennextjs/cloudflare": "^1.x",
    "tailwindcss": "^4.x",
    "@tailwindcss/postcss": "^4.x",
    "tw-animate-css": "^1.x",
    "zod": "^3.23.0",
    "@tanstack/react-query": "^5.x",
    "@tanstack/react-table": "^8.x",
    "next-intl": "^3.x",
    "lucide-react": "^0.x",
    "@sentry/nextjs": "^8.x",
    "resend": "^4.x",
    "@anthropic-ai/sdk": "^0.x",
    "date-fns": "^4.x",
    "clsx": "^2.x",
    "tailwind-merge": "^3.x"
  },
  "devDependencies": {
    "typescript": "^5.x",
    "vitest": "^2.x",
    "@playwright/test": "^1.x",
    "eslint": "^9.x",
    "eslint-config-next": "^16.x"
  }
}
```

shadcn/ui components are vendored into `src/components/ui/` (not pinned). Updated component-by-component via `npx shadcn@latest add ...`.

Renovate runs every Monday 9am, auto-merges patch + low-risk minor updates after CI green. Major and framework-major upgrades labeled and held for human review. See **RENOVATE.md**.

---

## Open decisions (OD-1 to OD-6, see DECISIONS.md)

These are flagged in the relevant phase docs. None blocks v0.1 phase 00–06:

- **OD-1 (Phase 13, v0.3):** Tamar Telecom — Partner API access vs email parsing fallback
- **OD-2 (Phase 09, v0.2):** Vehicle check form — keep public on painlessremovals or PWA only? (Rec: PWA only)
- **OD-3 (Phase 10, v0.2):** Liveswitch scope — upload-only or full live SDK
- **OD-4 (Phase 17, v0.3):** iMVE migration scope — full historical vs 12 months active (Rec: 12 months active + read-only archive)
- **OD-5 (Phase 01, v0.2):** 2FA for admin from v0.1 or v0.2 (Rec: v0.2 mandatory, v0.1 optional)
- **OD-6 (Phase 09, v0.2):** Worker PWA session length — 7 days vs 30 days (Rec: 7 days)

---

## Costs (steady state)

| Item | Cost/month | Notes |
|------|------------|-------|
| Supabase Pro | $25 | Includes daily backup retained 7 days. Multi-tenant safe. |
| Supabase PITR (point-in-time recovery) | +$100 | **Optional**. Required only if hourly recovery granularity matters — defer to v0.3 |
| Cloudflare Workers Paid | already paid | $5/month if not yet — we already pay for painlessremovals |
| Resend | $20 | 50k emails/month |
| Sentry | $26 | Team plan |
| Anthropic API (Haiku duplicate detection) | ~£0.5 (≈$1) | Painless v0.1 volume; rate-limited 100/hour |
| WhatsApp Business API (Meta direct, post-v0.3) | ~£10 | Per-conversation pricing, low volume |
| **v0.1 Total** | **~$72/mo** | Without PITR |
| **v0.2 Total** | **~$80/mo** | + WhatsApp prep |
| **v0.3 Total (typical)** | **~$95–195/mo** | + PITR if enabled, + WhatsApp at full volume |

One-off: Tamar Partner API setup if approved (TBD), Liveswitch (already owned), GoCardless setup (£0, pay-as-you-go).

---

## What this spec is NOT

- It's not a working codebase. It's a build plan that Claude Code uses phase by phase.
- It's not a fixed-price contract. Phases will reveal unknowns; re-scoping is expected.
- It's not a SaaS spec. Multi-tenant infra is in place day 1, but white-labelling is post-v0.3.
- It's not a competitor to enterprise CRMs. It's deliberately Painless-shaped, with knobs future tenants can re-tune.

---

## Changelog

**v2.1** — Schema sync sweep (deleted_at + version on 21 tables, jobs stage timestamps + SLA + profit-review fields, review_requests/customer_signoffs/complaints fields, notes is_customer_visible). New tables: `documents` (polymorphic vault). Phase 01 audit trigger fixed to v2 defensive pattern. Latest stable version pin + Renovate strategy. New Phase 06b bundles 10 v0.1 features: SLA dashboard, profit-by-job (manual input), Cmd+K search, manual call log, job timeline, requote one-click, document vault, exports, internal/visible notes, owner daily home. New ADRs: 016 SLA, 017 dependency policy, 018 documents, 019 profit-by-job manual input v0.1, 020 pg_trgm search. New top-level docs: `SCHEMA_CONTRACT.md`, `RENOVATE.md`. Webhook fixtures fully populated.

**v2** — Schema bug sweep, webhook hardening, review gating removed, iOS PWA mandates, scope split into v0.1/v0.2/v0.3. New top-level docs: STATE_MACHINE, SECURITY_MODEL, DECISIONS, INTEGRATION_CONTRACTS, ERROR_HANDLING, MIGRATION_MAPPING, DATA_DICTIONARY.

**v1** — Initial 18-phase plan, monolithic timeline.
