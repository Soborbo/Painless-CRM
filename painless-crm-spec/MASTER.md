# Painless CRM — Master Specification

**Project**: `painless-crm` (separate repo from `painlessremovals`)
**Domain**: `crm.painlessremovals.com`
**Owner**: Soborbo Ltd / Painless Removals (Jay Newton)
**Tenancy**: Single-tenant launch (Painless), multi-tenant ready (`company_id` on every row from day 1)
**Started**: May 2026
**Realistic timeline**: 13–15 months solo, vibe-coded with Claude Code

---

## Why this exists

Replace iMVE (£X/mo SaaS) with a custom operations platform that:

1. Owns the data — no vendor lock-in, no rate limits, no "feature when they ship it"
2. Integrates natively with the existing painlessremovals.com calculator + tracking stack
3. Becomes a **multi-tenant SaaS product** in 18+ months, sold to other UK removals SMEs
4. Encodes Painless-specific operations logic (pricing v4.2, dynamic capacity pricing, contractor workflow) that no off-the-shelf CRM models well

The CRM is **not** a marketing site, not a chatbot, not a calculator — those live in `painlessremovals.com`. The CRM is the operations brain.

---

## Stack — final, locked

| Layer | Choice | Version | Why |
|---|---|---|---|
| Framework | Next.js | 16.2.x (pinned) | App Router, Server Actions, stable Turbopack, Adapters API stable |
| UI runtime | React | 19.2.x | Compiler 1.0 stable, View Transitions, useEffectEvent |
| Bundler | Turbopack | bundled | 5–10x faster Fast Refresh, default in 16 |
| Compiler | React Compiler | 1.0 stable | Auto-memoization, enable in `next.config.ts` |
| Styling | Tailwind CSS | v4 | Aligned with painlessremovals + skill set |
| Components | shadcn/ui | latest (Tailwind v4) | Composable primitives, owned code |
| Validation | Zod | latest | Server Action input validation, form schemas |
| Language | TypeScript | 5.x | Strict mode, no `any` |
| Database | Supabase Postgres | Pro tier ($25/mo) | RLS, Realtime, Storage, Auth, daily backups |
| Auth | Supabase Auth | built-in | Email + password, magic link option for workers |
| Storage | Supabase Storage | built-in | Photos, videos, signed PDFs |
| Email | Resend | $20/mo tier | Transactional, deliverability, open tracking |
| Hosting | Cloudflare Workers | Paid plan (already owned) | Unified with painlessremovals, Workers binding to KV |
| Adapter | `@opennextjs/cloudflare` | latest | Adapters API stable since Next 16.2 |
| Pricing broadcast | Cloudflare KV | (Workers Paid) | Edge-replicated single-source-of-truth for pricing config |
| Error tracking | Sentry | $26/mo Team | Day 1 — no PII forwarded, source maps uploaded |
| i18n | next-intl | latest | English active, Hungarian placeholder for future SaaS markets |
| Testing | Vitest + Playwright | latest | Unit + critical-path E2E, no exhaustive coverage |

**Steady-state cost**: ~$70–100/month (Supabase + Resend + Sentry; Cloudflare already paid).

**Smoke test gate (Phase 0)**: If 4 things don't work on Cloudflare Workers within 2 working days, switch CRM hosting to Vercel and revisit. The 4 things:
1. PDF generation for invoices (Cloudflare Browser Rendering or fallback)
2. Image processing for photo uploads (Cloudflare Images or fallback)
3. Supabase Realtime over WebSocket through the Workers runtime
4. ExcelJS-style export for reports

If any 2 fail, switch. This decision is **time-boxed** and not revisited later.

---

## Architecture map

```
                                  ┌──────────────────────────┐
                                  │  painlessremovals.com    │
                                  │  (Cloudflare Workers)    │
                                  │  Astro 6 + React 19      │
                                  │                          │
                                  │  /instantquote/* (calc)  │
                                  │  /api/save-quote.ts      │ ─┐
                                  │  /api/contact.ts         │ ─┤  webhooks
                                  │  /api/callbacks.ts       │ ─┤  HMAC-signed
                                  │  /api/affiliate.ts       │ ─┤
                                  │  /api/clearance-callback │ ─┤
                                  │  /api/partner-register   │ ─┤
                                  │  /api/vehicle-check      │ ─┤  (TBD: keep public or move?)
                                  │                          │ │
                                  │  reads: KV pricing       │ │
                                  │  reads: KV availability  │ │
                                  └──────────────────────────┘ │
                                                               │
                                                               ▼
┌──────────────────────────┐      ┌──────────────────────────┐
│  Cloudflare KV           │      │  crm.painlessremovals.com│
│                          │ ◀───▶│  (Cloudflare Workers)    │
│  pricing:current         │      │  Next.js 16.2 App Router │
│  pricing:v4.2            │      │                          │
│  availability:2026-W19   │      │  /api/webhooks/*         │
│  availability:2026-W20   │      │  /(dashboard)/*          │
│                          │      │  /(worker-pwa)/*         │
└──────────────────────────┘      │  /(public)/availability  │
                                  │                          │
                                  └────────────┬─────────────┘
                                               │
                                               ▼
                                  ┌──────────────────────────┐
                                  │  Supabase (EU region)    │
                                  │                          │
                                  │  Postgres + RLS          │
                                  │  Auth (email + magic)    │
                                  │  Storage (photos, videos)│
                                  │  Realtime (kanban, chat) │
                                  │  Edge Functions (cron)   │
                                  └──────────────────────────┘
                                               │
                                               ▼
                                  ┌──────────────────────────┐
                                  │  External services       │
                                  │                          │
                                  │  Resend (email)          │
                                  │  Xero (invoicing)        │
                                  │  GoCardless (Direct      │
                                  │    Debit recurring)      │
                                  │  Twilio (SMS)            │
                                  │  WhatsApp Business API   │
                                  │  Liveswitch (video)      │
                                  │  Tamar (call email parse)│
                                  │  Google Ads API (offline │
                                  │    conversion upload)    │
                                  │  Meta CAPI (offline)     │
                                  │  Sentry (errors)         │
                                  │  Anthropic (Claude API   │
                                  │    for AI signals)       │
                                  └──────────────────────────┘
```

---

## Domain model — top level

The **job** is the central entity. A `lead` is just `job.stage = 'lead'`. There is no separate `leads` table.

```
companies
  └── users (sales reps, admins, surveyors)
  └── workers (contractors — separate from users, optional login)
  └── customers
        ├── customer_relationships (spouse_of, employee_of, referred_by)
        ├── jobs (the lifecycle entity, lead → quoted → confirmed → completed → archived)
        │     ├── job_addresses (from / to / via)
        │     ├── quotes (versioned, with snapshot of pricing_version)
        │     ├── job_assignments (worker × van × date)
        │     ├── time_entries (clock in/out per worker per job)
        │     ├── vehicle_checks (per assignment)
        │     ├── photos (before/during/after, damage)
        │     ├── job_notes (admin / staff / mention threads)
        │     ├── job_sheets (loader-filled at end of job)
        │     ├── customer_signoffs (mobile-signed)
        │     ├── invoices (deposit, custom, final)
        │     └── activity_log (every state change, every interaction)
        └── storage_rentals
              ├── containers
              ├── recurring_invoices
              └── direct_debit_mandates

vehicles (vans, trailers)
  └── vehicle_compliance (MOT, tax, insurance, service dates)
  └── vehicle_assignments (daily driver, daily reviewer)

pricing_versions (versioned, immutable once issued)
  └── jobs.quotes reference a frozen snapshot

affiliates (estate agents, partners)
  └── affiliate_codes
  └── attributions (lead → affiliate)

settings (per-company customization, mirroring iMVE)
  ├── job_statuses (configurable workflow)
  ├── email_templates
  ├── sms_templates
  ├── whatsapp_templates
  ├── automation_rules (status_change → action)
  ├── pricing_templates (presets)
  └── feature_flags
```

Full SQL schema in `references/schema.sql`. TypeScript types in `references/types.ts`.

---

## The job lifecycle

> **Canonical definition lives in `STATE_MACHINE.md`.** This section is a summary; that file is the source of truth. SQL enum, kanban, automation engine, and reporting all derive from STATE_MACHINE.md. CI test (Phase 04) enforces no drift.

Summary: 13 stages organised as pre-quote (4) → active (5) → closed-won (1) + closed-lost (3).

```
lead → contacted → survey_scheduled → quoted → accepted → confirmed → in_progress → completed → invoiced → paid
         │             │                  │         │
         └─────────────┴──────────────────┘         └──→ declined / dead / cancelled
```

Each stage has an optional `sub_status` for higher-resolution tracking (e.g., `quoted` + `awaiting_video`, `quoted` + `followup_sent_1`). Sub-statuses are display-only — they don't change automation. Free-form-ish, constrained per company in `settings.allowed_sub_statuses`.

The **storage track** is parallel and branches at `accepted` for jobs that include storage products:
```
accepted (with storage) → storage_rentals.status: pending_collection → active → pending_delivery → terminated
```

A customer can have multiple jobs in different stages simultaneously. The `customer_relationships` table handles spouse_of, employee_of, referred_by relationships.

For full transition rules, required fields per transition, automation triggers per stage, and iMVE migration mapping examples, see **STATE_MACHINE.md**.

---

## Multi-tenancy contract

Every table that holds tenant data has `company_id UUID NOT NULL` as the second column (after `id`). RLS policies enforce `company_id = current_user_company_id()`.

For Painless, `company_id = '00000000-0000-0000-0000-000000000001'` — hardcoded constant in seed.

When a 2nd tenant onboards (Phase 18+, post-MVP):
1. Create `companies` row with new UUID
2. Seed `settings.*` rows with defaults
3. Create `users` for that tenant
4. They start clean — no Painless data is visible

**No table** may use `auth.uid()` directly in RLS without first verifying `company_id`. The pattern:

```sql
CREATE POLICY tenant_isolation ON table_name
  FOR ALL TO authenticated
  USING (company_id = (SELECT company_id FROM users WHERE auth_id = auth.uid()))
  WITH CHECK (company_id = (SELECT company_id FROM users WHERE auth_id = auth.uid()));
```

See `references/rls-patterns.md`.

---

## Roles (canonical)

| Role | Description | Access |
|---|---|---|
| `super_admin` | Soborbo (Laszlo) | All tenants, all data, hidden from tenant UI |
| `admin` | Tenant owner (Jay) | Full tenant access + settings + billing |
| `manager` | Tenant operations lead | Full data access, no settings, no user management |
| `sales` | Sales rep | All customers + jobs they own + shared, limited delete |
| `surveyor` | Field surveyor | Assigned jobs + customer cards, photo/video upload |
| `loader` | Loader/driver (worker user) | Only their assigned jobs, time tracking, vehicle check, sign-off form |
| `accounts` | Bookkeeping | Invoices + payments + customer billing data, no operational data |
| `viewer` | Read-only stakeholder (Jay's accountant, investor) | Reports + finance, no PII export |

Workers (contractors) by default are NOT users — they exist as `workers` rows. They become users (with role `loader`) only if they need PWA access. Many small contractors won't need login.

---

## Cross-cutting principles (enforced everywhere)

1. **Audit log on every mutation.** A trigger writes `entity_type`, `entity_id`, `action`, `before`, `after`, `actor_id`, `at` to `activity_log`. No bypass.

2. **Soft delete only.** `deleted_at` column. RLS hides soft-deleted rows by default. Hard delete requires `super_admin` and is logged separately.

3. **Optimistic concurrency.** Every editable row has `version int`. Updates assert `WHERE id = ? AND version = ?` and increment. UI shows conflict resolution if 409.

4. **Webhook deduplication.** Every inbound webhook has an `event_id`. We dedup on `event_id` for 24h via `webhook_events` table. Replays are no-ops.

5. **No PII in logs, no PII in Sentry.** Sentry SDK configured with `beforeSend` to strip known PII fields. Application logs use structured fields, never log raw bodies.

6. **No PII in dataLayer (mirrors painlessremovals rule).** GA4 + Meta CAPI hashing happens server-side only.

7. **Idempotent integrations.** Xero invoice sync, Resend email send, GoCardless mandate creation — all use deterministic external IDs. Retries don't double-send.

8. **Edge of system has Zod.** Every Server Action, every API route, every webhook handler validates input via Zod schema. Schemas live in `lib/schemas/`.

9. **Server Actions over API routes** for mutations. API routes only for: webhooks (external can't call Server Actions), public endpoints (no auth), and streaming responses.

10. **Realtime sparingly.** Only kanban board, job notes thread, and active call tracking subscribe to Supabase Realtime. Not the lead list, not the dashboard. Realtime is expensive at edge.

11. **i18n from day 1.** Every user-facing string goes through `useTranslations('namespace')`. English active, Hungarian placeholder. No hardcoded strings in JSX.

12. **Feature flags for risky launches.** `feature_flags` table per company. Dynamic pricing, AI duplicate detection, AI photo cubic estimation — all flag-gated for gradual rollout.

---

## Build phases

Read `phases/` in order. Phases 0–6 are the v0.1 scope. Phases 7–11 are v0.2 scope. Phases 12–17 are v0.3 scope. Each version is independently deployable.

> **Scope split is canonical.** See ADR-012. The previous monolithic 13–15 month timeline was optimistic; the realistic full-build is 14–21 months across three releases. Splitting lets Jay use v0.1 in 6–9 months and gives v0.2/v0.3 the benefit of production feedback.

### v0.1 — Internal CRM (months 1–10)

**Goal:** Painless internal go-live. Sales team uses the new system end-to-end. iMVE remains source of historical truth (read-only).

| # | Phase | Title | Detail | Est. weeks |
|---|---|---|---|---|
| 00 | Foundation | Next.js + Supabase + Cloudflare + smoke test | Full | 2 |
| 01 | Auth & Multi-tenant | Supabase Auth + RLS pattern + roles + i18n | Full | 2 |
| 02 | Database Schema | Full schema, RLS, audit log, soft delete | Full | 2 |
| 03 | Customer 360 | B2C/B2B customers, relationships, LTV | Full | 3 |
| 04 | Jobs & Pipeline | Job lifecycle (STATE_MACHINE.md), kanban, duplicate detection | Full | 3 |
| 05 | Pricing Engine | Versioned pricing, KV broadcast, calculator webhook | Full | 4 |
| 06 | Quote Builder | Quote PDF, public acceptance, e-sign | Full | 3 |
| **06b** | **Light Modules (v2.1)** | **SLA dashboard, profit-by-job, search, timeline, requote, vault, exports, owner home** | **Full** | **4** |
| (light) | Email | Resend setup + transactional templates | Light | 1 |
| (light) | Reporting v0 | Basic dashboards (lead funnel, sales conversion) | Light | 2 |

**Total v0.1:** 26 weeks ≈ 6–7 months at 100% focus, 8–10 months realistic with admin/client overhead.

### v0.2 — Operations + Xero (months 10–15)

**Goal:** Crews work fully from PWA, invoices flow to Xero, customers self-serve sign-off and reviews.

| # | Phase | Title | Detail | Est. weeks |
|---|---|---|---|---|
| 07 | Capacity & Dynamic Pricing | Calendar, traffic light, public availability | Skeleton | 3 |
| 08 | Resource Management | Vehicles, storage, staff, rota | Skeleton | 4 |
| 09 | Worker PWA | iOS-aware foreground sync, clock-in, GPS, vehicle check | Skeleton (v2) | 4 |
| 10 | Job Execution | Sheets, surveys, photos, video, Liveswitch | Skeleton | 3 |
| 11 | Customer Sign-off & Review | Universal review request (no gating), complaint flow | Skeleton (v2) | 2 |
| 12a | Invoicing — Xero portion | Xero sync, invoice generation, payment capture | Skeleton | 3 |

**Total v0.2:** 19 weeks ≈ 4–6 months realistic.

### v0.3 — Full automation + migration (months 16–21)

**Goal:** iMVE retired. Painless runs entirely on the new CRM. WhatsApp/SMS automation, GoCardless DD, full reporting.

| # | Phase | Title | Detail | Est. weeks |
|---|---|---|---|---|
| 12b | Invoicing — GoCardless DD + dunning | Recurring storage billing, mandate flow | Skeleton | 2 |
| 13 | Communications Hub | Email/SMS/WhatsApp, automation engine | Skeleton | 4 |
| 14 | Reporting v2 | KPIs, attribution, offline conversions | Skeleton | 3 |
| 15 | Notifications & Collab | Push, in-app, @mention | Skeleton | 2 |
| 16 | Affiliate & Quality Layer | Referrals, insurance, SLA, scorecard | Skeleton | 2 |
| 17 | Migration & Go-Live | iMVE CSV import, smoke tests, deploy | Skeleton | 3 |

**Total v0.3:** 16 weeks ≈ 4–6 months realistic.

**Grand total:** 14–21 months across three releases. Each release is internally complete and deployable.

---

## What's NOT in scope (yet)

To prevent scope creep, these are explicitly out of v1.0:

- Native iOS / Android apps (PWA is the contract)
- Custom email server (always Resend)
- Custom payment processor (always Xero + GoCardless)
- AI chatbot embedded in CRM (the chatbot is its own project on `painlessremovals.com`)
- Multi-language UI activation beyond English (placeholder only)
- White-label customization for tenants beyond config (custom CSS / domains is post-1.0)
- HMRC RTI payroll integration (contractors only — invoice generation is enough)
- Live video survey calls between sales rep and customer (Liveswitch upload-only in v1)
- Native call tracking integration with Tamar (email parsing is the contract)

These live in `BACKLOG.md` and revisit after Phase 17 ships.

---

## Open decisions

The chronological ADR log is in **DECISIONS.md** (15 ADRs accepted, 6 open decisions OD-1 through OD-6). Open items relevant to building order:

- **OD-1** — Tamar Telecom Partner API access vs email parsing (Phase 13, v0.3)
- **OD-2** — Vehicle check form on painlessremovals.com vs PWA only (Phase 9, v0.2; rec: PWA only)
- **OD-3** — Liveswitch v0.2 scope: upload-only or full live SDK (Phase 10, v0.2)
- **OD-4** — iMVE migration scope: full historical or 12 months active (Phase 17, v0.3; rec: 12 months active + read-only archive)
- **OD-5** — 2FA for admin from v0.1 or v0.2 (rec: v0.2 mandatory, v0.1 optional)
- **OD-6** — Worker PWA session length: 7 days vs 30 days (rec: 7 days)

Resolved (now ADRs):
- ADR-010 — Universal review request (was: NPS gate review). Decision: no gating. Implemented in Phase 11 v2.
- ADR-011 — iOS PWA foreground sync (was: background-sync default). Decision: foreground sync mandatory.
- ADR-012 — v0.1/v0.2/v0.3 scope split (was: monolithic 13–15 month build). Decision: three releases, 14–21 months total.
- ADR-008 — Payment allocations as proper table (was: JSONB). Decision: relational table.
- ADR-009 — OAuth credentials encrypted in dedicated table (was: scattered).
- ADR-013 — Job stage canonical in STATE_MACHINE.md (was: drift between MASTER prose and SQL enum).
- ADR-014 — Webhook v2 with full hardening (was: HMAC + idempotency only).

---

## Build doctrine

Read this when you forget why something is the way it is.

- **The spec is the contract.** If a phase doc says "no X", and you're tempted to add X, open a PR to update the spec first. Then build.
- **Phase ordering is intentional.** You can't build the worker PWA before the auth+multi-tenant foundation. Don't skip ahead.
- **Test on real Painless data early.** Phase 17 (migration) imports historical data, but Phase 0 should seed at least 5 fake customers and 10 fake jobs so the dashboard is not empty during dev.
- **Deploy to staging from week 1.** A dev that only works on localhost is a dev that breaks in production at month 6. Cloudflare Workers preview env exists, use it.
- **Vibe coding is a tool, not a religion.** When the AI suggests something that contradicts the spec, the spec wins. Update the spec or correct the AI.
- **Single-developer mode is a constraint, not an excuse.** Document as you build. The day you onboard a co-founder or hand off, your past self thanks present you.

---

## Reference files

### Top-level (canonical specs)
- `STATE_MACHINE.md` — canonical job lifecycle (stages, transitions, automation hooks, SLA hooks v2.1)
- `SCHEMA_CONTRACT.md` — per-table doctrine matrix (v2.1)
- `SECURITY_MODEL.md` — threats, multi-tenant contract, webhook hardening, PII rules
- `DECISIONS.md` — chronological ADR log (20 ADRs)
- `INTEGRATION_CONTRACTS.md` — per-provider integration specs
- `ERROR_HANDLING.md` — error code namespace, retry policy, Sentry rules
- `RENOVATE.md` — dependency update strategy (v2.1)
- `MIGRATION_MAPPING.md` — iMVE → painless-crm field mapping
- `DATA_DICTIONARY.md` — every business field with explanation
- `TEST_FIXTURES/` — Jay's 17 v4.2 pricing scenarios + webhook test fixtures (v2.1: fully populated)

### `references/` (pattern library)
- `references/schema.sql` — Full Postgres schema (v2.1: 62 tables, deleted_at + version on every mutable business table, jobs SLA + profit fields, documents vault)
- `references/types.ts` — TypeScript domain types (mirrors schema)
- `references/rls-patterns.md` — RLS policy templates (reusable)
- `references/kv-broadcast.md` — Cloudflare KV write/read pattern
- `references/audit-log.md` — Audit log trigger pattern (v2.1 defensive)
- `references/webhook-pattern.md` — Inbound webhook handler v2 (5-gate hardened)

### Backups
- `references-v1/`, `phases-v1/`, `MASTER.v1.md`, `INDEX.v1.md`, `CLAUDE.v1.md` — v1 snapshots, do not edit

---

## License & ownership

Source code: All rights reserved, Soborbo Ltd. Not open source.
Spec: All rights reserved, Soborbo Ltd. Confidential.
