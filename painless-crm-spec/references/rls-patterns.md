# RLS Policy Patterns

This document defines the canonical patterns for Row-Level Security (RLS) policies in painless-crm. Every Phase 2+ table follows these patterns. Deviations require justification in the migration comment.

## Why this matters

RLS is the **only** thing standing between Tenant A's data and Tenant B's eyes. App code can have bugs; database-enforced policies cannot be bypassed by app bugs. Treat RLS as a security invariant.

---

## Pattern 1 — Tenant isolation (every user-data table)

Every table that holds tenant-specific data:

```sql
alter table {table_name} enable row level security;

create policy {table_name}_tenant_isolation on {table_name}
  for all to authenticated
  using (company_id = current_user_company_id())
  with check (company_id = current_user_company_id());
```

The `using` clause filters reads. The `with check` clause prevents users from inserting/updating rows with a different `company_id`. **Both must be present.**

If a table doesn't have `company_id`, it's either:
- A platform-level table (e.g., `companies` itself) — uses different policies
- A typo / oversight — fix it before continuing

---

## Pattern 2 — Soft-delete hiding

For tables with `deleted_at`, the default RLS hides soft-deleted rows from regular queries:

```sql
create policy {table_name}_hide_soft_deleted on {table_name}
  for select to authenticated
  using (
    company_id = current_user_company_id()
    and deleted_at is null
  );
```

A separate "trash" policy lets admins see soft-deleted rows:

```sql
create policy {table_name}_admin_see_deleted on {table_name}
  for select to authenticated
  using (
    company_id = current_user_company_id()
    and (select role from users where auth_id = auth.uid()) in ('admin', 'super_admin')
  );
```

When both policies match, Postgres OR's them — admins see everything, regular users see only non-deleted.

---

## Pattern 3 — Role-based write restrictions

Some tables restrict mutations to specific roles. Layer on top of tenant isolation:

```sql
create policy {table_name}_admin_only_modify on {table_name}
  for all to authenticated
  using (
    company_id = current_user_company_id()
    and (select role from users where auth_id = auth.uid()) in ('admin', 'manager')
  )
  with check (
    company_id = current_user_company_id()
    and (select role from users where auth_id = auth.uid()) in ('admin', 'manager')
  );
```

Examples where this applies:
- `settings` — only admin/manager can modify
- `pricing_versions` — only admin/manager
- `automation_rules` — only admin/manager
- `affiliates` — only admin/manager

The default tenant policy (`for all`) is replaced by this stricter policy.

---

## Pattern 4 — Worker-scoped access (PWA)

Workers (loaders) only see jobs they're assigned to. Special policy for `jobs` table:

```sql
create policy jobs_loader_scoped on jobs
  for select to authenticated
  using (
    company_id = current_user_company_id()
    and (
      -- Office staff see all
      (select role from users where auth_id = auth.uid()) in ('admin', 'manager', 'sales', 'surveyor', 'accounts')
      OR
      -- Loaders only see assigned jobs
      ((select role from users where auth_id = auth.uid()) = 'loader'
        and exists (
          select 1 from job_assignments ja
          join workers w on w.id = ja.worker_id
          where ja.job_id = jobs.id
            and w.user_id = (select id from users where auth_id = auth.uid())
        ))
    )
  );
```

Same pattern for `time_entries`, `vehicle_checks`, `photos`, `job_sheets` — loaders see only their own work.

---

## Pattern 5 — Activity log (insert via trigger only)

Audit log must not be tampered with. Users can read their tenant's log but cannot insert/update/delete directly:

```sql
alter table activity_log enable row level security;

create policy activity_log_read on activity_log
  for select to authenticated
  using (company_id = current_user_company_id());

-- Revoke direct DML from authenticated role
revoke insert, update, delete on activity_log from authenticated;

-- Trigger function uses security definer to insert on behalf of users
-- (already handled by log_activity() function)
```

---

## Pattern 6 — Public webhooks bypass RLS via service role

Inbound webhooks (from painlessremovals, GoCardless, Resend) cannot have an authenticated user. They use the Supabase service role key, which bypasses RLS.

**Critical**: service role key is ONLY used in:
- `src/lib/supabase/admin.ts` (singleton)
- Webhook handlers in `src/app/api/webhooks/*`
- Internal admin endpoints `src/app/api/admin/*` (super_admin gated by separate auth check)

Never import `admin.ts` from a Server Action or page component. The CI lint enforces this.

---

## Pattern 7 — Cross-table joins inside RLS

When a table joins to another for permission, use a subquery:

```sql
-- job_addresses are tenant-isolated through their parent job
create policy job_addresses_through_job on job_addresses
  for all to authenticated
  using (
    exists (
      select 1 from jobs
      where jobs.id = job_addresses.job_id
        and jobs.company_id = current_user_company_id()
    )
  );
```

Avoid policies that scan the entire table. Always anchor on an indexed lookup.

---

## Pattern 8 — Public read with token (acceptance pages, signoff)

Some pages are publicly accessible via a unique token (e.g., quote acceptance, customer signoff). These don't go through `authenticated` role:

```sql
-- Quote acceptances readable via the acceptance_token (public route)
-- This is handled at the application layer, not via RLS, because the token
-- is in the URL and not in JWT claims.

-- Pattern: server-side route reads via service_role with explicit token check:
-- 1. Verify token matches an existing quote_acceptance (or pending quote)
-- 2. Use admin client to read the quote
-- 3. Render to anonymous user

-- RLS still protects: no anonymous role can SELECT from quotes table directly.
-- The route is the only path; the token is the secret.
```

---

## Pattern 9 — super_admin escape hatch

`super_admin` (Soborbo / Laszlo) needs to access any tenant for support. NOT via app code paths — via service_role with audit logging:

```sql
-- All policies above filter by current_user_company_id().
-- super_admin sessions DO NOT use authenticated role for cross-tenant access.
-- Instead, super_admin uses dedicated /api/admin/* routes that:
--   1. Verify current user has super_admin role
--   2. Log the cross-tenant access to a separate `support_audit_log` table
--   3. Use service_role client to access target tenant
--   4. Show clear UI banner: "You are viewing tenant X as support"
```

This separation prevents accidentally writing app code that breaks tenant isolation when the dev-test user happens to be super_admin.

---

## Testing RLS

Every Phase 2+ migration must include an RLS test in CI:

```ts
// tests/security/tenant-isolation.spec.ts

test('user A cannot see user B tenant customers', async () => {
  // Setup
  const { tenantA, tenantB, userA, userB } = await setupTwoTenants();
  const customerA = await createCustomer(tenantA.id, 'Alice');
  const customerB = await createCustomer(tenantB.id, 'Bob');

  // User A queries customers
  const supabaseA = await loginAs(userA);
  const { data: aResults } = await supabaseA.from('customers').select('*');

  expect(aResults).toHaveLength(1);
  expect(aResults[0].id).toBe(customerA.id);
  expect(aResults.map(c => c.id)).not.toContain(customerB.id);
});

test('user A cannot insert customer with tenant B company_id', async () => {
  const supabaseA = await loginAs(userA);
  const { error } = await supabaseA.from('customers').insert({
    company_id: tenantB.id,  // attempted leak
    customer_type: 'individual',
    first_name: 'Mallory',
    last_name: 'Hacker',
  });
  expect(error).toBeDefined();  // RLS rejects
});
```

Extend this suite for every new table that holds tenant data. If you add a table without an RLS test, the build fails (verified by a CI rule that checks `migrations/` count vs `tests/security/` count).

---

## Common pitfalls

1. **Forgetting `with check` on a tenant policy** — user can update their own row to change `company_id` and leak data. Always include `with check`.
2. **Using `auth.uid()` directly without resolving `users.company_id`** — multiple users in the same auth.users could be created across tenants if invitation flow has a bug. Always resolve via `current_user_company_id()`.
3. **Adding policies at deploy time but not testing** — RLS in development with seed data masks issues. Test with adversarial data (User A trying to access User B's rows).
4. **Service role used in app code** — easy to do, hard to spot. CI lint rule: any import of `@/lib/supabase/admin` outside `src/app/api/webhooks/*` and `src/app/api/admin/*` fails the build.
5. **Functions without `security definer`** — `current_user_company_id()` must be `security definer` so it can read `users` table even if RLS would block direct access. Same for `find_duplicate_candidates` and others.

---

## Helper functions reference

```sql
-- Resolve company from auth context
create or replace function current_user_company_id()
returns uuid language sql stable security definer as $$
  select company_id from users where auth_id = auth.uid() limit 1
$$;

-- Resolve role from auth context
create or replace function current_user_role()
returns text language sql stable security definer as $$
  select role from users where auth_id = auth.uid() limit 1
$$;

-- Check if current user has any of the specified roles
create or replace function current_user_has_role(roles text[])
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from users
    where auth_id = auth.uid()
      and role = any(roles)
      and active = true
  )
$$;
```

Use `current_user_has_role(array['admin', 'manager'])` in policies for cleaner reads.
