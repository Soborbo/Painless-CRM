# CLAUDE.md — painless-crm

This file is loaded automatically by Claude Code. It defines the rules of engagement for AI-assisted development on this repository.

## Project

Painless CRM — operations platform for Painless Removals (Bristol, UK).
Replacing iMVE. Multi-tenant ready. Single-developer build (Laszlo / Soborbo Ltd).

**Spec docs (read in order):**
- `MASTER.md` — architecture overview + scope split
- `DECISIONS.md` — ADR log; the "why" behind every choice
- `STATE_MACHINE.md` — canonical job lifecycle (SQL enum derives from this)
- `SECURITY_MODEL.md` — multi-tenant contract, webhook hardening, PII rules
- `INTEGRATION_CONTRACTS.md` — per-provider integration spec
- `phases/NN-*.md` — current phase you're building
- `references/*` — patterns referenced from phases

## Stack (locked, do not change without spec PR)

- Next.js 16.2 (App Router, Turbopack, React Compiler)
- React 19.2
- TypeScript 5.x strict
- Tailwind CSS v4 + shadcn/ui
- Supabase (Postgres + Auth + RLS + Storage + Realtime)
- Cloudflare Workers + `@opennextjs/cloudflare`
- Cloudflare KV for pricing + availability broadcast
- Zod for all input validation
- Resend for email
- Sentry for errors (no PII)
- next-intl for i18n
- Vitest + Playwright for tests

## File structure

```
src/
├── app/
│   ├── (dashboard)/       # Authenticated office UI (admin, sales, etc.)
│   ├── (worker)/          # Worker PWA (loaders, drivers)
│   ├── (public)/          # Public availability calendar
│   ├── api/
│   │   ├── webhooks/      # Inbound from painlessremovals + 3rd parties
│   │   └── cron/          # Cloudflare Cron triggered
│   └── proxy.ts           # Auth + tenant resolution (replaces middleware.ts)
├── lib/
│   ├── supabase/          # client.ts, server.ts, admin.ts
│   ├── schemas/           # Zod schemas (one file per domain entity)
│   ├── pricing/           # Pricing engine (mirrors painlessremovals)
│   ├── tracking/          # GA4 + Meta CAPI server-side mirrors
│   ├── kv/                # Cloudflare KV write helpers
│   ├── integrations/      # xero/, resend/, twilio/, gocardless/, etc.
│   └── utils/
├── components/
│   ├── ui/                # shadcn/ui primitives
│   └── domain/            # Domain components (CustomerCard, JobKanban, etc.)
├── i18n/
│   └── messages/          # en.json, hu.json
└── types/                 # Shared types (DB types are auto-generated)
```

## DO NOT MODIFY without permission

- `src/lib/supabase/server.ts` — auth flow, easy to break
- `src/lib/supabase/admin.ts` — service role, security-critical
- `src/app/proxy.ts` — tenant resolution
- `src/lib/kv/pricing.ts` — single source of pricing reads
- `src/lib/webhooks/handler.ts` — the v2 hardened shell, security-critical
- `src/lib/integrations/credentials.ts` — pgcrypto encrypt/decrypt + access logging
- Any file under `src/lib/integrations/*/auth.ts`
- The audit log trigger function in any migration (only spec PRs touch this)

If you think one of these needs to change, stop and ask the human. Or write an ADR proposal first.

## After every change

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build  # only before commit, not every save
```

If any fail, fix before continuing. Never commit broken builds.

## Coding rules

1. **Hungarian-comment forbidden in code.** Spec is English, code is English, UI strings are i18n keys. Comments in Hungarian only inside private internal docs (e.g., `BACKLOG.md`).
2. **No `any`.** Use `unknown` and narrow. If a 3rd-party type is bad, declare a local interface.
3. **Server Actions for mutations.** API routes only for webhooks, public endpoints, and streaming.
4. **Every Server Action validates with Zod.** Schema in `lib/schemas/`, imported.
5. **Every Server Action calls `auth.getUser()`** (not `getSession()`). Resolve tenant from user.
6. **No raw SQL in app code.** Use Supabase query builder or RPC functions defined in `references/schema.sql`.
7. **Max 200 lines per file.** Split if longer.
8. **Components are Server Components by default.** Add `'use client'` only when needed (state, effects, browser APIs).
9. **No `process.env` in app code.** Read from `cloudflare:workers` env type. Validate via Zod at boot.
10. **Audit log is automatic.** The trigger handles it. Don't manually insert into `activity_log` — that's a smell.
11. **Soft delete only.** `deleted_at = now()`. Never `DELETE FROM`.
12. **Optimistic concurrency.** Read `version`, write `WHERE id = ? AND version = ?`, increment.
13. **STATE_MACHINE.md is law.** Job stage transitions, required fields per stage, automation hooks all derive from this doc. The SQL enum mirrors it, the kanban respects it, automation triggers off it. If you need to change stages, edit STATE_MACHINE.md FIRST, then SQL, then code.
14. **Webhook handler v2 is mandatory.** Every inbound webhook uses `createWebhookHandler` from `lib/webhooks/handler.ts`. No bespoke handlers. See `references/webhook-pattern.md`.
15. **Payment allocations use the `payment_allocations` table, not JSONB.** A payment never "knows" its invoices directly — always through allocations. See ADR-008.
16. **Integration credentials use `integration_credentials` table.** Never store OAuth tokens in env vars (env vars are for non-OAuth API keys like `RESEND_API_KEY`). See ADR-009.
17. **Universal review request, no NPS gating.** Every paid customer gets the same email. See ADR-010 and Phase 11.
18. **iOS PWA: foreground sync is mandatory.** Visible "Sync now" button + unsynced counter at all times. Never rely on Background Sync API alone. See ADR-011 and Phase 9.

## ADR discipline

Every architectural decision becomes an ADR appended to `DECISIONS.md`. Before making a decision that:
- Adds a column to a "spine" table (customers, jobs, quotes, invoices, payments)
- Changes a state machine
- Introduces a new external integration
- Picks a library where alternatives matter
- Resolves an open decision (OD-1 to OD-6)

…**stop and write an ADR**. Format:
```
## ADR-NNN — short title
**Date:** {date}
**Status:** accepted | superseded by ADR-XXX
**Context:** what problem
**Decision:** what we chose
**Alternatives considered:** what we rejected and why
**Consequences:** what this costs us
```

Phase docs reference ADRs (`See ADR-007`) instead of restating decisions. One source of truth.

## Multi-tenant rules (enforced)

- Every table that holds tenant data has `company_id UUID NOT NULL`.
- Every RLS policy filters by `company_id = current_user_company_id()`.
- The `super_admin` role bypasses RLS — never use this in app code, only in dedicated admin endpoints.
- Test data uses `company_id = '00000000-0000-0000-0000-000000000001'` (Painless).

## i18n rules

- Every user-facing string: `t('namespace.key')`.
- Add the key to `src/i18n/messages/en.json` first.
- `hu.json` mirrors structure with empty strings — Hungarian translation deferred.
- Server-side strings (emails, PDF invoices) also use i18n.

## PII handling (security-critical)

Forbidden in:
- Sentry events (configured `beforeSend` strips known fields)
- Application logs (use structured logger, never log full request body)
- dataLayer / GTM (mirror painlessremovals rules)
- KV values (KV is for pricing config, availability, never customer data)
- URL query params on internal routes
- Error messages shown to user (generic "something went wrong")

Allowed in:
- Supabase rows (encrypted at rest, RLS-protected)
- Resend email contents (transactional, recipient-bound)
- WhatsApp / SMS (encrypted in transit)

## Git conventions

- Branches: `phase/NN-feature-name` for phase work, `fix/short-name` for fixes.
- Commits: conventional commits (`feat:`, `fix:`, `chore:`, `docs:`).
- PRs: small, single-concern, link to phase doc and acceptance criteria.
- Never merge a PR with red CI.

## Smoke test gates

Phase 0 has 4 smoke tests (PDF gen, image processing, Realtime, Excel export). If 2 of 4 fail on Cloudflare Workers, the human must approve a stack pivot to Vercel before Phase 1 starts.

## When in doubt

- Check `MASTER.md` for the architectural intent.
- Check `phases/NN-*.md` for the current scope.
- Check `references/*` for canonical patterns.
- If still unclear, ask the human before guessing.

The spec is the contract. The AI is a fast typist with good judgment, not the architect.
