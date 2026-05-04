# painless-crm

Custom multi-tenant operations CRM for Painless Removals (Bristol, UK), built by Soborbo Ltd.
Replaces the legacy iMVE system. Spec lives in `../painless-crm-spec/`.

## Status

**Phase 00 — Foundation.** Project scaffolded; smoke tests stubbed. Live infrastructure
(Supabase Pro, Cloudflare account, Sentry, DNS) is not yet provisioned — see
[Phase 00 hand-off](#phase-00-hand-off) below.

## Stack

- Next.js 16.2 · React 19.2 · TypeScript 5.x (strict)
- Tailwind v4 · shadcn/ui (vendored later)
- Supabase (Postgres + Auth + RLS + Storage + Realtime)
- Cloudflare Workers via `@opennextjs/cloudflare`
- Cloudflare KV for pricing + availability broadcast
- Zod · next-intl · React Query · Resend · Sentry
- Biome (lint + format) · Vitest · Playwright

## Local development

```bash
corepack enable
pnpm install
cp .env.example .env.local   # fill in Supabase URL + anon key
pnpm dev
```

After every change, run:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build  # before commit
```

## Layout

```
src/
├── app/
│   ├── (internal)/smoke/   Phase 00 smoke-test gate (super_admin only)
│   ├── dashboard/          Empty Phase 00 placeholder
│   ├── login/              Email + password sign-in
│   ├── proxy.ts            Auth + tenant resolution
│   ├── layout.tsx
│   └── page.tsx            Landing
├── lib/
│   ├── env.ts              Zod-validated env
│   ├── supabase/           client.ts, server.ts, admin.ts
│   ├── sentry/             PII strip
│   ├── smoke/              Smoke runner + types
│   ├── integrations/       Per-provider modules (pdf, image, realtime, excel)
│   └── utils/cn.ts
├── i18n/
│   ├── config.ts
│   └── messages/{en,hu}.json
└── components/             ui/, domain/  (Phase 03+)
supabase/
├── config.toml
├── migrations/
│   └── 00000000000000_init.sql
└── seed.sql
```

## Phase 00 hand-off

The four deliverables that need a human (you):

1. **Supabase Pro project** in `eu-west-2` (London). Add URL + anon key to `.env.local`,
   set `SUPABASE_SERVICE_ROLE_KEY` as a Wrangler secret in prod.
2. **Cloudflare account** — KV namespaces already provisioned (account
   `075668606da58c5b96a45a075f1ca99c`, IDs wired in `wrangler.toml`):
   - `painless-crm-PRICING_KV` + `-preview`
   - `painless-crm-AVAILABILITY_KV` + `-preview`

   Still TODO: `wrangler login`, bind Browser Rendering + Cloudflare Images,
   set Worker secrets via `wrangler secret put NAME` for each entry under
   `wrangler.toml` "Secrets" comment.
3. **Sentry project** — paste DSN into `.env.local` (`SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN`).
4. **DNS** — point `crm.painlessremovals.com` at Cloudflare Workers.

Until those exist, the four smoke tests report `partial`. Once wired:

- Replace each `runXSmokeTest()` stub in `src/lib/integrations/*/test.ts` with the real
  Cloudflare-binding calls described in `phases/00-foundation.md` §0.7.
- Visit `/smoke` while signed in as a `super_admin` user. Gate clears when all 4 are
  `pass`. If 2+ fail, document a stack pivot in `DECISIONS.md` per spec §0 acceptance.

## Spec

Authoritative: `../painless-crm-spec/`. Read in order: `INDEX.md` → `MASTER.md` →
`DECISIONS.md` → `STATE_MACHINE.md` → `phases/00-foundation.md`.
