# Phase 02 — Database Schema

**Goal**: Create the full Painless CRM domain schema in Postgres. Every subsequent phase builds UI on top of this. Get the schema right now or pay 10x later.

**Duration estimate**: 2 weeks
**Status**: Not started
**Prerequisite**: Phase 01 complete

---

## Why this phase

The schema is the irreversible decision. Adding a column is cheap. Refactoring relationships once 50K rows exist and 20 UI screens depend on them is brutal. This phase produces a single migration file (or numbered series) that defines all tables required for Phase 3–17.

Ship the full schema. UI fills in over months. Schema gets it right once.

---

## Deliverables

1. Full `references/schema.sql` migrated to Supabase Pro
2. RLS policies on every table (tenant isolation + role overlays)
3. Audit log triggers on every mutable table
4. Indexes for common query patterns documented + benchmarked
5. Generated TypeScript types (`pnpm supabase gen types typescript`)
6. Seed file with realistic test data (10 customers, 20 jobs, 5 vehicles, 2 storage sites)
7. RPC functions for common cross-table operations

---

## Schema overview (groups)

### A. Core (already in Phase 0/1)
- `companies`
- `users`, `workers`
- `settings`
- `activity_log`
- `user_invitations`

### B. Customer & contacts (this phase)
- `customers` — B2C and B2B unified, with type discriminator
- `customer_contacts` — multiple contacts per business customer (billing, operations)
- `customer_relationships` — spouse_of, employee_of, referred_by
- `customer_consents` — GDPR marketing consent log

### C. Properties & addresses (this phase)
- `addresses` — reusable, deduplicated by postcode + line1
- `properties` — type, floor, lift, parking, access notes

### D. Jobs (the spine, this phase)
- `jobs` — the lifecycle entity
- `job_addresses` — from / to / via, ordered, with property reference
- `job_status_history` — every status transition
- `job_notes` — admin / staff threads, with @mention support
- `job_tags` — flexible labels (VIP, recurring, B2B, etc.)

### E. Quotes & pricing (this phase)
- `pricing_versions` — versioned config snapshots
- `quotes` — per job, with frozen pricing snapshot
- `quote_acceptances` — customer e-sign records

### F. Resources (this phase)
- `vehicles` — vans, trailers
- `vehicle_compliance` — MOT, tax, insurance, service log
- `storage_sites` — physical warehouses
- `storage_containers` — units within sites
- `storage_rentals` — recurring relationship between customer and container

### G. Operations (this phase, schema only — UI in Phase 8/9/10)
- `job_assignments` — worker × vehicle × job × date
- `time_entries` — clock in/out per worker per job, with GPS
- `vehicle_checks` — pre-trip inspection records
- `photos` — uploaded media (before/during/after/damage)
- `videos` — Liveswitch / Dropbox / WhatsApp ingested
- `job_sheets` — loader-completed end-of-job paperwork
- `customer_signoffs` — mobile-signed acceptance forms

### H. Money (this phase)
- `invoices` — deposit, custom, final, recurring
- `invoice_lines` — line items
- `payments` — receipts, allocations
- `direct_debit_mandates` — GoCardless integration

### I. Affiliate / referrals (this phase)
- `affiliates` — estate agents, partners
- `affiliate_codes`
- `attributions` — links lead → affiliate

### J. Communications (this phase, schema; UI in Phase 13)
- `email_templates`
- `sms_templates`
- `whatsapp_templates`
- `automation_rules`
- `messages` — outbound log (email, sms, whatsapp)
- `message_events` — opens, clicks, deliveries (Resend webhook)
- `phone_calls` — inbound from Tamar email parsing

### K. Webhook plumbing (this phase)
- `webhook_events` — inbound dedup
- `webhook_subscriptions` — outbound (for future API customers)

---

## Key design patterns

### 1. Soft delete on every entity

Every table that holds user-visible data has:
```sql
deleted_at timestamptz,
```

RLS hides `deleted_at IS NOT NULL` rows by default:
```sql
create policy hide_soft_deleted on customers
  for select to authenticated
  using (
    company_id = current_user_company_id()
    and deleted_at is null
  );
```

A separate "trash bin" view shows soft-deleted rows for admins to restore.

### 2. Optimistic concurrency on every mutable entity

```sql
version int not null default 1,
```

Updates always: `WHERE id = ? AND version = ?` and `SET version = version + 1`. UI catches affected_rows = 0 and shows conflict resolution.

### 3. Created/updated timestamps + actors

Every entity has:
```sql
created_at timestamptz not null default now(),
updated_at timestamptz not null default now(),
created_by_id uuid references users(id),
updated_by_id uuid references users(id),
```

Trigger maintains `updated_at`:
```sql
create or replace function set_updated_at() returns trigger as $$
begin
  NEW.updated_at = now();
  return NEW;
end;
$$ language plpgsql;
```

### 4. Job status as a state machine, not a flat enum

```sql
create type job_stage as enum (
  'lead',           -- initial enquiry, not yet contacted
  'contacted',      -- in conversation, no quote yet
  'quoted',         -- quote sent, awaiting response
  'accepted',       -- quote accepted, awaiting move date
  'confirmed',      -- date set, deposit paid (if required)
  'in_progress',    -- move day
  'completed',      -- moved, awaiting final payment
  'paid',           -- closed and paid
  'declined',       -- customer chose not to proceed
  'dead',           -- no response after follow-ups
  'cancelled'       -- cancelled after acceptance
);

create table jobs (
  ...
  stage job_stage not null default 'lead',
  sub_status text,  -- free-form per stage: 'awaiting_video', 'followup_2', etc.
  decline_reason text,  -- only when stage in ('declined', 'dead', 'cancelled')
  ...
);
```

Configurable `job_statuses` table per company maps which `sub_status` values are valid for each `stage`. Defaults seeded for Painless from iMVE list.

### 5. Address deduplication

Addresses are first-class entities:
```sql
create table addresses (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id),  -- yes, even addresses are tenant-scoped
  line1 text not null,
  line2 text,
  city text not null,
  postcode text not null,
  country text not null default 'GB',
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  geocoded_at timestamptz,
  -- Dedup hash (line1 + postcode normalized)
  dedup_key text generated always as (
    lower(regexp_replace(line1, '\s+', '', 'g')) || '|' || lower(regexp_replace(postcode, '\s+', '', 'g'))
  ) stored,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index addresses_dedup_idx on addresses(company_id, dedup_key) where deleted_at is null;
```

When creating an address, upsert on `(company_id, dedup_key)`. Same physical address used by multiple jobs/customers points to the same row, enabling clean "all jobs at this address" queries.

### 6. Pricing version snapshot

```sql
create table pricing_versions (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id),
  version_label text not null,  -- 'v4.2', 'v5.0-summer-2026'
  effective_from timestamptz not null,
  effective_to timestamptz,  -- null = current
  -- The full config (versioned, immutable)
  margin_matrix jsonb not null,  -- 5x3
  crew_hourly_rate_pence int not null,
  van_hourly_rate_pence int not null,
  pass_through_config jsonb not null,
  complications jsonb not null,
  size_categories jsonb not null,
  distance_bands jsonb not null,
  dynamic_pricing_enabled boolean default false,
  capacity_bands jsonb,
  modulation_sources text[],
  quote_validity_days int default 7,
  notes text,
  created_by_id uuid references users(id),
  created_at timestamptz not null default now()
);

create unique index pricing_versions_active_idx on pricing_versions(company_id) where effective_to is null;
```

When Jay updates pricing in admin UI, the previous row's `effective_to` is set to `now()`, and a new row is inserted with `effective_from = now()`, `effective_to = null`. Old quotes reference their `pricing_version_id` and never see new pricing.

### 7. Customer 360 with B2C/B2B unified

```sql
create table customers (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id),
  customer_type text not null check (customer_type in ('individual', 'business')),

  -- Individual fields (used when customer_type = 'individual')
  first_name text,
  last_name text,
  date_of_birth date,

  -- Business fields (used when customer_type = 'business')
  company_name text,
  vat_number text,
  payment_terms_days int,

  -- Common
  primary_email text,
  primary_phone text,
  primary_address_id uuid references addresses(id),

  -- Source / attribution
  acquisition_source text,
  acquisition_campaign text,
  affiliate_id uuid references affiliates(id),
  first_contact_at timestamptz,

  -- Consents
  marketing_consent boolean default false,
  marketing_consent_at timestamptz,

  -- Computed (via materialized view or RPC, not column)
  -- lifetime_value_pence (sum of paid invoices)
  -- job_count
  -- last_job_at

  notes text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by_id uuid references users(id),
  updated_by_id uuid references users(id),
  version int not null default 1,

  constraint customers_individual_required check (
    customer_type = 'individual' implies (first_name is not null and last_name is not null)
  ),
  constraint customers_business_required check (
    customer_type = 'business' implies (company_name is not null)
  )
);
```

`customer_contacts` adds multiple people per business customer (billing contact, ops contact, etc.). For individual customers, the customer row IS the contact.

`customer_relationships` links customers:
```sql
create table customer_relationships (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id),
  from_customer_id uuid not null references customers(id),
  to_customer_id uuid not null references customers(id),
  relationship_type text not null check (relationship_type in (
    'spouse_of', 'partner_of', 'employee_of', 'employer_of',
    'parent_of', 'child_of', 'referred_by', 'referred',
    'friend_of'
  )),
  notes text,
  created_at timestamptz not null default now()
);
```

This enables the "Jonny Hall booked a move for Relish Agency" pattern — Jonny is `employee_of` Relish, both are customers, the job is owned by Relish (billing) but Jonny is the contact.

---

## Indexes (the ones that matter)

```sql
-- Customer search (fuzzy on name, email, phone)
create index customers_search_idx on customers using gin (
  (
    coalesce(first_name, '') || ' ' ||
    coalesce(last_name, '') || ' ' ||
    coalesce(company_name, '') || ' ' ||
    coalesce(primary_email, '') || ' ' ||
    coalesce(primary_phone, '')
  ) gin_trgm_ops
) where deleted_at is null;

-- Jobs by stage (kanban board)
create index jobs_stage_idx on jobs(company_id, stage, updated_at desc) where deleted_at is null;

-- Jobs by customer (customer 360 view)
create index jobs_customer_idx on jobs(customer_id, created_at desc) where deleted_at is null;

-- Jobs by assigned sales rep
create index jobs_assigned_to_idx on jobs(assigned_to_id, stage) where deleted_at is null;

-- Activity log by entity (audit trail per record)
create index activity_log_entity_idx on activity_log(entity_type, entity_id, occurred_at desc);

-- Time entries by worker (payroll export)
create index time_entries_worker_period_idx on time_entries(worker_id, started_at desc);
```

Run `EXPLAIN ANALYZE` on the kanban query and the customer search before phase ends. Document any plans that scan more than 1000 rows for typical queries.

---

## RPC functions

For complex cross-table operations, use Postgres functions called via Supabase RPC:

```sql
-- Compute customer LTV
create or replace function customer_lifetime_value(p_customer_id uuid)
returns bigint
language sql
stable
security definer
as $$
  select coalesce(sum(amount_pence), 0)::bigint
  from payments
  where customer_id = p_customer_id
    and company_id = current_user_company_id()
    and deleted_at is null
$$;

-- Find duplicate candidates (Phase 4 uses this)
create or replace function find_duplicate_candidates(
  p_email text default null,
  p_phone text default null,
  p_postcode text default null
)
returns setof customers
language sql
stable
security definer
as $$
  select * from customers
  where company_id = current_user_company_id()
    and deleted_at is null
    and (
      (p_email is not null and primary_email = p_email)
      or (p_phone is not null and primary_phone = p_phone)
      or (p_postcode is not null and exists (
        select 1 from addresses
        where addresses.id = customers.primary_address_id
          and addresses.postcode = p_postcode
      ))
    )
$$;
```

---

## Acceptance criteria

- [ ] Migration file applies cleanly to a fresh Supabase project
- [ ] All tables have RLS enabled
- [ ] Cross-tenant leak test (extended for Phase 2 tables) passes
- [ ] Audit log captures inserts/updates/soft-deletes on all mutable tables
- [ ] `pnpm supabase gen types typescript` produces clean TS types
- [ ] Seed data: 10 customers (mix of B2C/B2B), 20 jobs (across all stages), 5 vehicles, 2 storage sites with containers, 5 affiliates
- [ ] Dashboard renders customer list and job kanban with seed data (UI scaffolding only, full UI is Phase 3/4)
- [ ] EXPLAIN ANALYZE on kanban query, customer search, customer 360 view documented in `references/query-plans.md`

---

## Files created in this phase

```
supabase/migrations/
├── 00000000000002_phase02_customers.sql
├── 00000000000003_phase02_addresses_properties.sql
├── 00000000000004_phase02_jobs.sql
├── 00000000000005_phase02_pricing.sql
├── 00000000000006_phase02_resources.sql
├── 00000000000007_phase02_operations.sql
├── 00000000000008_phase02_money.sql
├── 00000000000009_phase02_affiliate.sql
├── 00000000000010_phase02_communications.sql
├── 00000000000011_phase02_webhooks.sql
└── 00000000000012_phase02_indexes_and_rpc.sql

supabase/seed.sql (extended)

src/types/database.ts (auto-generated, committed)

references/
├── schema.sql (full annotated reference, mirrors migrations)
├── query-plans.md
└── rls-patterns.md (extended)
```

---

## Out of scope

- UI for any of these tables (Phase 3+)
- Real Xero / GoCardless integration (Phase 12)
- Real Resend / WhatsApp sends (Phase 13)
- Webhook receiver implementation (Phase 5)
- Pricing engine logic (Phase 5)
