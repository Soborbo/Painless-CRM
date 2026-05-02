# Phase 00 — Foundation

**Goal**: Stand up the project skeleton, validate the stack works end-to-end on Cloudflare Workers + Supabase, gate the rest of the build on a 4-test smoke check.

**Duration estimate**: 2 weeks
**Status**: Not started
**Prerequisite**: None

---

## Why this phase

Before investing 13+ months into a stack, prove the stack works for the hardest 4 features the CRM will need. If any 2 of 4 fail on Cloudflare Workers within 2 working days, switch hosting to Vercel and revisit before Phase 1 starts.

This is the only time-boxed escape hatch in the project. Use it.

---

## Deliverables

1. Repo initialized with Next.js 16.2 + Tailwind v4 + shadcn/ui + Supabase Pro project
2. Cloudflare Workers deploy working (preview + production env)
3. Supabase Pro project provisioned in EU region with daily backups
4. Sentry project created, errors flowing
5. CI pipeline (GitHub Actions): typecheck, lint, build on every push
6. Staging deployment auto-deploys from `main`
7. **All 4 smoke tests passing** (or stack pivoted)
8. `CLAUDE.md` and `AGENTS.md` checked into repo
9. `.env.example` complete and documented

---

## Step-by-step build

### 0.1 — Repo init

```bash
pnpm create next-app@latest painless-crm \
  --typescript \
  --tailwind \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --no-eslint  # we add our own ESLint config

cd painless-crm
git init
git checkout -b main
```

Pin versions immediately in `package.json`:

```json
{
  "dependencies": {
    "next": "16.2.0",
    "react": "19.2.0",
    "react-dom": "19.2.0"
  }
}
```

Use `^` only on patch range. No `~`. No `>=`.

### 0.2 — Cloudflare Workers adapter

```bash
pnpm add -D @opennextjs/cloudflare wrangler
```

Create `wrangler.toml`:

```toml
name = "painless-crm"
main = ".open-next/worker.js"
compatibility_date = "2026-04-01"
compatibility_flags = ["nodejs_compat"]

[vars]
NEXT_PUBLIC_APP_URL = "https://crm.painlessremovals.com"

[[kv_namespaces]]
binding = "PRICING_KV"
id = "TBD"  # create via wrangler kv:namespace create

[[kv_namespaces]]
binding = "AVAILABILITY_KV"
id = "TBD"

# Secrets set via: wrangler secret put NAME
# SUPABASE_SERVICE_ROLE_KEY
# RESEND_API_KEY
# SENTRY_AUTH_TOKEN
# CRM_WEBHOOK_SECRET (HMAC for inbound from painlessremovals)
# ANTHROPIC_API_KEY
```

Update `package.json` scripts:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "deploy": "opennextjs-cloudflare && wrangler deploy",
    "preview": "opennextjs-cloudflare && wrangler dev",
    "typecheck": "tsc --noEmit",
    "lint": "biome check .",
    "test": "vitest",
    "test:e2e": "playwright test"
  }
}
```

### 0.3 — Supabase Pro project

1. Create project at supabase.com — region `eu-west-2` (London) or `eu-central-1` (Frankfurt). London preferred for Painless.
2. Upgrade to Pro tier ($25/mo) — enables daily backups, 7-day PITR, no auto-pause.
3. Generate `anon` key and `service_role` key.
4. Enable Auth providers: Email + password, Magic Link.
5. Configure Auth email templates with custom Resend SMTP (see Phase 13 for templates; for now, Supabase defaults are fine).

Initial bootstrap migration (`supabase/migrations/00000000000000_init.sql`):

```sql
-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";  -- for fuzzy search

-- Companies (multi-tenant root)
create table companies (
  id uuid primary key default uuid_generate_v4(),
  slug text unique not null,
  name text not null,
  status text not null default 'active' check (status in ('active', 'suspended', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Seed Painless
insert into companies (id, slug, name) values
  ('00000000-0000-0000-0000-000000000001', 'painless', 'Painless Removals');

-- Users (extends auth.users)
create table users (
  id uuid primary key default uuid_generate_v4(),
  auth_id uuid unique not null references auth.users(id) on delete cascade,
  company_id uuid not null references companies(id) on delete restrict,
  email text not null,
  full_name text not null,
  role text not null check (role in (
    'super_admin', 'admin', 'manager', 'sales', 'surveyor', 'loader', 'accounts', 'viewer'
  )),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index users_auth_id_idx on users(auth_id);
create index users_company_id_idx on users(company_id);

-- Helper function for RLS
create or replace function current_user_company_id()
returns uuid
language sql
stable
security definer
as $$
  select company_id from users where auth_id = auth.uid() limit 1
$$;

-- Activity log (audit trail)
create table activity_log (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id),
  entity_type text not null,
  entity_id uuid not null,
  action text not null,  -- 'create' | 'update' | 'delete' | 'soft_delete' | custom verbs
  before jsonb,
  after jsonb,
  actor_id uuid references users(id),
  actor_label text,  -- fallback when actor_id is null (system, webhook)
  occurred_at timestamptz not null default now(),
  ip_address inet,
  user_agent text
);

create index activity_log_company_id_idx on activity_log(company_id);
create index activity_log_entity_idx on activity_log(entity_type, entity_id);
create index activity_log_occurred_at_idx on activity_log(occurred_at desc);
```

Run migration locally:
```bash
pnpm supabase db push
```

### 0.4 — Auth + middleware (proxy.ts in Next 16)

`src/app/proxy.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function proxy(request: NextRequest) {
  const response = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const isAuthRoute = request.nextUrl.pathname.startsWith('/login') ||
                      request.nextUrl.pathname.startsWith('/auth');
  const isPublicRoute = request.nextUrl.pathname.startsWith('/api/webhooks') ||
                        request.nextUrl.pathname.startsWith('/availability') ||
                        request.nextUrl.pathname === '/';

  if (!user && !isAuthRoute && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.).*)'],
};
```

`src/lib/supabase/server.ts` and `src/lib/supabase/client.ts` per Supabase SSR docs.

### 0.5 — Sentry

```bash
pnpm add @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

Edit `sentry.server.config.ts` to strip PII:

```ts
import * as Sentry from '@sentry/nextjs';

const PII_KEYS = [
  'email', 'phone', 'first_name', 'last_name', 'full_name',
  'address', 'street', 'city', 'postcode', 'postal_code',
  'date_of_birth', 'national_insurance', 'company_name',
];

function stripPII(obj: any): any {
  if (typeof obj !== 'object' || obj === null) return obj;
  if (Array.isArray(obj)) return obj.map(stripPII);
  const out: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (PII_KEYS.includes(key.toLowerCase())) {
      out[key] = '[REDACTED]';
    } else {
      out[key] = stripPII(value);
    }
  }
  return out;
}

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  beforeSend(event) {
    if (event.request?.data) event.request.data = stripPII(event.request.data);
    if (event.extra) event.extra = stripPII(event.extra);
    if (event.contexts) event.contexts = stripPII(event.contexts);
    return event;
  },
});
```

### 0.6 — i18n bootstrap

```bash
pnpm add next-intl
```

`src/i18n/messages/en.json`:
```json
{
  "common": {
    "save": "Save",
    "cancel": "Cancel",
    "loading": "Loading…",
    "error": "Something went wrong"
  },
  "auth": {
    "signIn": "Sign in",
    "email": "Email",
    "password": "Password"
  }
}
```

`src/i18n/messages/hu.json` mirrors structure with empty strings (Hungarian translation deferred to post-1.0).

### 0.7 — Smoke tests (the gate)

Create `src/app/(internal)/smoke/page.tsx`. Auth-protected, super_admin only. Runs the 4 tests on demand and reports pass/fail.

#### Smoke test 1: PDF generation

```ts
// src/lib/integrations/pdf/test.ts
// Use Cloudflare Browser Rendering API (or fallback library)
// Generate a 1-page PDF with text "Hello, World" + an SVG logo
// Verify byte size > 0 and PDF magic bytes (%PDF-)
```

If Cloudflare Browser Rendering is not enabled on the account, alternative: `@cloudflare/puppeteer` via Workers Browser Bindings.

#### Smoke test 2: Image processing

```ts
// Upload a 4MB JPEG to Supabase Storage
// Resize to 800x600, convert to WebP
// Verify output size < 200kb
// Use Cloudflare Images binding (paid feature)
// Fallback: skia-canvas via Cloudflare Worker (limited)
```

#### Smoke test 3: Supabase Realtime

```ts
// Subscribe to a test table from the server-rendered page (via client component)
// Insert a row from another tab
// Verify the subscription fires within 2 seconds
// Verifies WebSocket transport works through Cloudflare Workers
```

#### Smoke test 4: Excel export

```ts
// Generate a 1000-row Excel file using SheetJS or ExcelJS
// Stream to response
// Verify the response completes within Workers CPU time limit (30s)
// Verify file opens in Excel/Numbers without corruption
```

Each test reports: `pass | fail | partial` and a one-paragraph note. The page shows a green/red status board.

### 0.8 — CI/CD

`.github/workflows/ci.yml`:

```yaml
name: CI
on: [push, pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm test
      - run: pnpm build
```

Cloudflare Pages or Wrangler deploy via GitHub Actions on `main` push. Use environment-scoped secrets.

### 0.9 — Seed data

`supabase/seed.sql` creates:
- 1 super_admin user (Laszlo)
- 1 admin user (Jay)
- 2 sales reps (Tom, Tamara)
- 1 surveyor
- 1 loader
- 1 accountant

Email + password for all dev users (use environment-scoped, not committed).

---

## Acceptance criteria (Definition of Done)

- [ ] `pnpm dev` starts the app, login page renders
- [ ] Can sign in as Jay (admin), redirected to `/dashboard` (empty state)
- [ ] Sentry captures a test error from server side
- [ ] Sentry strips email/phone from the captured event payload (verify in Sentry UI)
- [ ] CI passes on every push
- [ ] Production deploy to `crm.painlessremovals.com` working with Cloudflare Workers
- [ ] All 4 smoke tests pass on production env
- [ ] If any smoke test fails: stack pivot decision documented in `DECISIONS.md` and approved by human

**Hard gate**: do not start Phase 1 until smoke tests pass. If 2+ fail, switch to Vercel for the CRM (painlessremovals stays on Workers).

---

## Files created in this phase

```
painless-crm/
├── CLAUDE.md
├── AGENTS.md (mirror of CLAUDE.md for non-Anthropic agents)
├── README.md
├── MASTER.md (link to spec)
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
├── biome.json (lint config)
├── wrangler.toml
├── .env.example
├── .github/workflows/ci.yml
├── supabase/
│   ├── config.toml
│   ├── migrations/00000000000000_init.sql
│   └── seed.sql
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx (landing)
│   │   ├── login/page.tsx
│   │   ├── dashboard/page.tsx (empty state)
│   │   ├── (internal)/smoke/page.tsx
│   │   └── proxy.ts
│   ├── lib/
│   │   ├── supabase/{client,server,admin}.ts
│   │   ├── sentry/strip-pii.ts
│   │   └── env.ts (Zod-validated env)
│   ├── i18n/
│   │   ├── config.ts
│   │   └── messages/{en,hu}.json
│   └── components/ui/ (initial shadcn primitives)
├── tests/
│   ├── smoke/
│   │   ├── pdf.test.ts
│   │   ├── image.test.ts
│   │   ├── realtime.test.ts
│   │   └── excel.test.ts
│   └── e2e/
│       └── login.spec.ts
└── public/ (favicon, robots.txt, basic meta)
```

---

## Risk register

| Risk | Likelihood | Mitigation |
|---|---|---|
| Supabase Realtime over Cloudflare Workers WebSocket flaky | Medium | Smoke test 3 catches it; if flaky, use Realtime in browser only (already the default) |
| `@opennextjs/cloudflare` doesn't yet support a Next 16.2 feature | Medium | Avoid bleeding-edge features in Phase 0; stick to standard App Router |
| Sentry source map upload to Cloudflare Workers errors | Low | Documented; standard `@sentry/nextjs` plugin handles it |
| Cloudflare KV namespace not provisioned yet (Phase 5 needs it) | Low | Provision in Phase 0 even if unused — `wrangler kv:namespace create` |

---

## Out of scope for Phase 0

- Database schema beyond `companies`, `users`, `activity_log` (that's Phase 2)
- Domain UI (that's Phase 3+)
- Webhook endpoints (that's Phase 5)
- Pricing logic (that's Phase 5)
- Worker PWA (that's Phase 9)

Stay disciplined. Foundation is foundation.
