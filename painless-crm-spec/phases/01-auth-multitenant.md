# Phase 01 — Auth & Multi-tenant

**Goal**: Robust authentication, role-based access, tenant isolation enforced at the database level via RLS. Lock the multi-tenant pattern so every subsequent phase inherits it.

**Duration estimate**: 2 weeks
**Status**: Not started
**Prerequisite**: Phase 00 complete, smoke tests passed

---

## Why this phase

Multi-tenant added later is multi-tenant done badly. Every table from Phase 2 onward will have `company_id` and an RLS policy that uses `current_user_company_id()`. We lock that pattern here and write a one-page test that proves cross-tenant data leak is impossible.

This phase also establishes the 8 user roles, the user invitation flow, and the worker-vs-user distinction (workers without login can still be assigned jobs).

---

## Deliverables

1. Login + logout + password reset + magic link flows working
2. User invitation flow (admin invites by email, user sets password on first login)
3. Role-based UI gating via `<RequireRole>` component + server-side checks
4. RLS policies on `users` and `activity_log` tested for tenant isolation
5. `current_user_company_id()` SQL function performance-verified (no N+1 in RLS)
6. Cross-tenant leak test passing (auto-run in CI)
7. Worker entity introduced (separate from `users`, login optional)
8. Settings table per company with default seed
9. Audit log trigger generic + reusable

---

## Database additions

```sql
-- Workers (contractors, may or may not be users)
create table workers (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id),
  user_id uuid unique references users(id),  -- null if no login
  full_name text not null,
  phone text,
  email text,
  national_insurance text,  -- encrypted at column level (Phase 2 adds pgcrypto)
  hourly_rate_pence int,
  active boolean not null default true,
  notes text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version int not null default 1
);

create index workers_company_id_idx on workers(company_id) where deleted_at is null;
create index workers_user_id_idx on workers(user_id) where deleted_at is null;

-- Settings (per company customization)
create table settings (
  company_id uuid primary key references companies(id),
  -- Branding
  logo_url text,
  brand_color text default '#0066cc',
  -- Operations
  business_hours jsonb default '{"mon": "08:00-17:00", "tue": "08:00-17:00", "wed": "08:00-17:00", "thu": "08:00-17:00", "fri": "08:00-17:00", "sat": "09:00-13:00", "sun": "closed"}',
  default_quote_validity_days int default 7,
  default_deposit_percent numeric(5,2) default 25.00,
  -- Localization
  default_currency text default 'GBP',
  default_locale text default 'en-GB',
  default_timezone text default 'Europe/London',
  -- Feature flags
  feature_flags jsonb default '{}',
  -- Compliance
  vat_number text,
  ico_registration text,
  -- Metadata
  updated_at timestamptz not null default now()
);

-- Seed Painless settings
insert into settings (company_id, vat_number, ico_registration) values
  ('00000000-0000-0000-0000-000000000001', null, null);  -- Jay fills these in admin UI

-- User invitations
create table user_invitations (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id),
  email text not null,
  role text not null,
  invited_by_id uuid not null references users(id),
  token text unique not null,
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index user_invitations_token_idx on user_invitations(token) where accepted_at is null;
```

## RLS policies (the canonical pattern)

```sql
-- Enable RLS
alter table users enable row level security;
alter table workers enable row level security;
alter table settings enable row level security;
alter table user_invitations enable row level security;
alter table activity_log enable row level security;

-- Tenant isolation (read + write)
create policy users_tenant_isolation on users
  for all to authenticated
  using (company_id = current_user_company_id())
  with check (company_id = current_user_company_id());

create policy workers_tenant_isolation on workers
  for all to authenticated
  using (company_id = current_user_company_id())
  with check (company_id = current_user_company_id());

create policy settings_tenant_isolation on settings
  for all to authenticated
  using (company_id = current_user_company_id())
  with check (company_id = current_user_company_id());

create policy user_invitations_tenant_isolation on user_invitations
  for all to authenticated
  using (company_id = current_user_company_id())
  with check (company_id = current_user_company_id());

create policy activity_log_tenant_isolation on activity_log
  for select to authenticated
  using (company_id = current_user_company_id());

-- Activity log is INSERT-only via trigger (no direct user inserts)
revoke insert, update, delete on activity_log from authenticated;

-- Role-based policies (layered ON TOP of tenant isolation)
create policy users_admin_can_modify on users
  for all to authenticated
  using (
    company_id = current_user_company_id()
    and (select role from users where auth_id = auth.uid()) in ('admin', 'super_admin')
  );

-- super_admin bypass (for cross-tenant operations from internal admin endpoints)
-- This is achieved by using the service_role key (bypasses RLS entirely)
-- Never use service_role in app code outside dedicated /api/admin/* endpoints.
```

See `references/rls-patterns.md` for the full template library.

---

## Auth flow

### Sign in (email + password)

1. User enters email + password on `/login`
2. Server Action calls `supabase.auth.signInWithPassword()`
3. On success, `proxy.ts` resolves `users` row by `auth_id`, sets `tenant-id` cookie
4. Redirect to `/dashboard` or `?next` URL

### Sign in (magic link, for workers)

1. Worker enters email on `/login`
2. Server Action calls `supabase.auth.signInWithOtp({ email })`
3. Resend sends a templated magic link (custom template via Phase 13, default in Phase 1)
4. Click → `/auth/callback?token=…` → session established → redirect

Workers get magic links because most won't remember another password. Sales/admin get password (longer sessions, more convenient).

### Invitation flow

1. Admin clicks "Invite user" in `/dashboard/settings/users`
2. Form: email, role (dropdown). Server Action creates `user_invitations` row with token.
3. Resend sends invite email with link `/auth/accept-invite?token=…`
4. Page validates token, shows password set form
5. On submit: create `auth.users` entry, create `users` row with company_id from invitation, mark invitation accepted
6. Auto-sign-in, redirect to `/dashboard`

### Password reset

Standard Supabase `resetPasswordForEmail` flow. Custom email template (English only, Hungarian deferred).

---

## Server-side role checking

`src/lib/auth/require-role.ts`:

```ts
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';

type Role = 'super_admin' | 'admin' | 'manager' | 'sales' | 'surveyor' | 'loader' | 'accounts' | 'viewer';

export async function requireUser() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('users')
    .select('id, company_id, role, full_name, email')
    .eq('auth_id', user.id)
    .single();

  if (!profile) redirect('/login');
  return profile;
}

export async function requireRole(allowed: Role[]) {
  const user = await requireUser();
  if (!allowed.includes(user.role as Role)) {
    redirect('/dashboard?error=forbidden');
  }
  return user;
}
```

Server Components use these directly:

```tsx
// src/app/dashboard/settings/users/page.tsx
import { requireRole } from '@/lib/auth/require-role';

export default async function UsersPage() {
  const user = await requireRole(['admin', 'super_admin']);
  // ... fetch users, render
}
```

---

## Client-side gating component

`src/components/auth/RequireRole.tsx`:

```tsx
'use client';
import { useUser } from '@/lib/auth/user-context';

export function RequireRole({
  allowed,
  fallback = null,
  children
}: {
  allowed: Role[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}) {
  const user = useUser();
  if (!user || !allowed.includes(user.role)) return <>{fallback}</>;
  return <>{children}</>;
}
```

User context populated server-side and passed to root client provider.

---

## Audit log trigger (v2.1 defensive — see ADR-007)

Generic, attached to every mutating business table. The defensive `to_jsonb(NEW)->>'column'` pattern is critical: it makes the trigger safe to attach to any table, regardless of whether `deleted_at`, `company_id`, or `id` columns exist on it. Direct `NEW.deleted_at` access would crash at runtime on tables without that column.

```sql
create or replace function log_activity()
returns trigger
language plpgsql
security definer
as $$
declare
  v_actor_id uuid;
  v_action text;
  v_new_jsonb jsonb;
  v_old_jsonb jsonb;
  v_company_id uuid;
  v_entity_id uuid;
begin
  -- Resolve actor (null if SQL was run by service_role / system)
  begin
    select id into v_actor_id from users where auth_id = auth.uid() limit 1;
  exception when others then
    v_actor_id := null;
  end;

  -- Convert NEW/OLD to JSONB once. JSONB lookups via ->> are safe even when
  -- the referenced column doesn't exist on the row type — they return null
  -- instead of throwing. This is the defensive pattern that lets us attach
  -- this trigger to ANY table, including tables without deleted_at, company_id,
  -- or id columns of the expected shape.
  if TG_OP <> 'INSERT' then v_old_jsonb := to_jsonb(OLD); end if;
  if TG_OP <> 'DELETE' then v_new_jsonb := to_jsonb(NEW); end if;

  if (TG_OP = 'INSERT') then
    v_action := 'create';
  elsif (TG_OP = 'UPDATE') then
    v_action := case
      when (v_new_jsonb->>'deleted_at') is not null
       and (v_old_jsonb->>'deleted_at') is null then 'soft_delete'
      when (v_new_jsonb->>'deleted_at') is null
       and (v_old_jsonb->>'deleted_at') is not null then 'undelete'
      else 'update'
    end;
  elsif (TG_OP = 'DELETE') then
    v_action := 'hard_delete';
  end if;

  -- Resolve company_id and entity_id defensively
  v_company_id := coalesce(
    (v_new_jsonb->>'company_id')::uuid,
    (v_old_jsonb->>'company_id')::uuid
  );
  v_entity_id := coalesce(
    (v_new_jsonb->>'id')::uuid,
    (v_old_jsonb->>'id')::uuid
  );

  -- Skip audit on tables without company_id (e.g., 'companies' itself,
  -- 'activity_log', integration_credential_access_log). These are intentionally
  -- NO_AUDIT — they either are the audit log or they're system-level.
  if v_company_id is null then
    return coalesce(NEW, OLD);
  end if;

  insert into activity_log (
    company_id, entity_type, entity_id, action,
    before, after, actor_id, occurred_at
  ) values (
    v_company_id,
    TG_TABLE_NAME,
    v_entity_id,
    v_action,
    v_old_jsonb,
    v_new_jsonb,
    v_actor_id,
    now()
  );

  return coalesce(NEW, OLD);
end;
$$;
comment on function log_activity() is
  'Universal audit trigger. Safe to attach to any table (defensive JSONB cast pattern). Tables without company_id silently skipped.';

-- Attach to users, workers, settings, user_invitations
create trigger users_audit
  after insert or update or delete on users
  for each row execute function log_activity();

create trigger workers_audit
  after insert or update or delete on workers
  for each row execute function log_activity();
-- ... etc for every mutating table
```

In Phase 2+, every new table gets the same trigger declaration in its migration. Don't try to be clever with dynamic SQL.

---

## Cross-tenant leak test

`tests/security/tenant-isolation.spec.ts` runs in CI:

```ts
// Setup: create 2 companies, 2 users, 1 customer per company
// Test 1: User A queries customers — sees only company A's data
// Test 2: User A tries to UPDATE company B's customer by ID — RLS rejects
// Test 3: User A tries to INSERT customer with company_id of B — RLS rejects
// Test 4: Service role can see all (sanity check, then never use in app code)
// Test 5: Activity log queried by user A — sees only company A's events
```

If any test fails, build fails. This protects future you.

---

## Acceptance criteria

- [ ] Sign in with password works for admin, sales, accounts
- [ ] Sign in with magic link works for loader, surveyor
- [ ] Invitation flow: admin invites email → invite email arrives → accept → password set → signed in
- [ ] Password reset works
- [ ] Logout clears session and redirects to `/login`
- [ ] Protected routes redirect unauthenticated users to `/login?next=…`
- [ ] Role-based UI hides admin-only sections from sales users
- [ ] Cross-tenant leak test (5 cases) passes in CI
- [ ] Audit log captures every user/worker/settings change with correct actor_id
- [ ] Audit log entries cannot be inserted/updated/deleted directly by users (only via triggers)

---

## Files created in this phase

```
src/
├── app/
│   ├── login/page.tsx
│   ├── auth/
│   │   ├── callback/route.ts
│   │   ├── accept-invite/page.tsx
│   │   └── reset-password/page.tsx
│   └── dashboard/
│       └── settings/
│           └── users/
│               ├── page.tsx
│               └── invite-form.tsx
├── lib/
│   ├── auth/
│   │   ├── require-role.ts
│   │   ├── user-context.tsx
│   │   └── actions.ts (sign-in, sign-out, invite, accept-invite, reset)
│   └── schemas/
│       ├── auth.ts (Zod)
│       └── invite.ts
├── components/
│   └── auth/
│       └── RequireRole.tsx
supabase/
└── migrations/
    └── 00000000000001_phase01_auth.sql
tests/
└── security/
    └── tenant-isolation.spec.ts
```

---

## Open decisions (resolve before starting Phase 2)

- **Session length**: default 30 days for office users, 7 days for workers? Or always 30? (Recommendation: 30 office, 7 worker)
- **2FA**: required for admin role from day 1, or post-1.0? (Recommendation: post-1.0, but DB schema ready)
- **SSO**: Google Workspace SSO for Painless? (Recommendation: post-1.0; Jay's not asking)

---

## Out of scope

- Customer-facing portal (separate domain, post-1.0)
- API tokens for headless access (post-1.0)
- Webhook authentication (Phase 5 covers it)
