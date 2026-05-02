-- ============================================================================
-- Painless CRM — Reference Schema
-- ============================================================================
-- This file is the canonical reference. Migrations in supabase/migrations/
-- implement this in order; this file is the consolidated end-state.
--
-- Tenant pattern: every user-data table has company_id UUID NOT NULL.
-- Soft delete: every mutable entity has deleted_at timestamptz.
-- Optimistic concurrency: every editable entity has version int.
-- Audit log: every mutating table has a trigger to activity_log.
-- ============================================================================

-- =====================================================
-- Extensions
-- =====================================================
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

-- =====================================================
-- A. Core (Phase 0/1)
-- =====================================================

create table companies (
  id uuid primary key default uuid_generate_v4(),
  slug text unique not null,
  name text not null,
  status text not null default 'active' check (status in ('active', 'suspended', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

create or replace function current_user_company_id()
returns uuid language sql stable security definer as $$
  select company_id from users where auth_id = auth.uid() limit 1
$$;

create table workers (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id),
  user_id uuid unique references users(id),
  full_name text not null,
  phone text,
  email text,
  hourly_rate_pence int,
  active boolean not null default true,
  notes text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version int not null default 1
);
create index workers_company_id_idx on workers(company_id) where deleted_at is null;

create table settings (
  company_id uuid primary key references companies(id),
  logo_url text,
  brand_color text default '#0066cc',
  business_hours jsonb,
  default_quote_validity_days int default 7,
  default_deposit_percent numeric(5,2) default 25.00,
  default_currency text default 'GBP',
  default_locale text default 'en-GB',
  default_timezone text default 'Europe/London',
  feature_flags jsonb default '{}',
  vat_number text,
  ico_registration text,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
  version int not null default 1
);

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

create table activity_log (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id),
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  before jsonb,
  after jsonb,
  actor_id uuid references users(id),
  actor_label text,
  occurred_at timestamptz not null default now(),
  ip_address inet,
  user_agent text
);
create index activity_log_company_id_idx on activity_log(company_id);
create index activity_log_entity_idx on activity_log(entity_type, entity_id);
create index activity_log_occurred_at_idx on activity_log(occurred_at desc);

-- Generic audit log trigger
create or replace function log_activity()
returns trigger language plpgsql security definer as $$
declare
  v_actor_id uuid;
  v_action text;
  v_new_jsonb jsonb;
  v_old_jsonb jsonb;
  v_company_id uuid;
  v_entity_id uuid;
begin
  -- Resolve actor (may be null for system-initiated changes via service role)
  begin
    select id into v_actor_id from users where auth_id = auth.uid() limit 1;
  exception when others then
    v_actor_id := null;
  end;

  -- Convert NEW/OLD to JSONB once. JSONB lookups are safe even when the column
  -- doesn't exist on the row type — `->>` returns null instead of throwing.
  -- This is the defensive pattern that lets us attach this trigger to ANY table,
  -- whether or not it has deleted_at, company_id, or id columns of the expected type.
  if TG_OP <> 'INSERT' then
    v_old_jsonb := to_jsonb(OLD);
  end if;
  if TG_OP <> 'DELETE' then
    v_new_jsonb := to_jsonb(NEW);
  end if;

  -- Determine action
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

  -- Resolve company_id and entity_id defensively (column may not exist)
  v_company_id := coalesce(
    (v_new_jsonb->>'company_id')::uuid,
    (v_old_jsonb->>'company_id')::uuid
  );
  v_entity_id := coalesce(
    (v_new_jsonb->>'id')::uuid,
    (v_old_jsonb->>'id')::uuid
  );

  -- Skip audit log for tables without company_id (e.g., companies itself, activity_log).
  -- These are explicitly marked NO_AUDIT in the trigger attachment list.
  if v_company_id is null then
    return coalesce(NEW, OLD);
  end if;

  insert into activity_log (
    company_id, entity_type, entity_id, action, before, after, actor_id, occurred_at
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
  'Universal audit trigger. Safe to attach to any table. Uses JSONB casts so missing columns (deleted_at, company_id, id) do not throw. Tables without company_id are silently skipped (intentional — see DECISIONS.md ADR-007).';

-- Generic updated_at trigger
create or replace function set_updated_at() returns trigger as $$
begin
  NEW.updated_at = now();
  return NEW;
end;
$$ language plpgsql;

-- =====================================================
-- B. Customers (Phase 2)
-- =====================================================

create table addresses (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id),
  line1 text not null,
  line2 text,
  city text not null,
  postcode text not null,
  country text not null default 'GB',
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  geocoded_at timestamptz,
  dedup_key text generated always as (
    lower(regexp_replace(line1, '\s+', '', 'g')) || '|' || lower(regexp_replace(postcode, '\s+', '', 'g'))
  ) stored,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  version int not null default 1
  updated_at timestamptz not null default now()
);
create unique index addresses_dedup_idx on addresses(company_id, dedup_key) where deleted_at is null;

create table affiliates (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id),
  name text not null,
  type text check (type in ('estate_agent', 'B2B_partner', 'individual', 'other')),
  contact_name text,
  contact_email text,
  contact_phone text,
  address_id uuid references addresses(id),
  commission_type text check (commission_type in ('percent_revenue', 'flat_per_job', 'tiered')),
  commission_value numeric,
  commission_config jsonb,
  active boolean default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version int not null default 1
);

create table customers (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id),
  customer_type text not null check (customer_type in ('individual', 'business')),
  first_name text,
  last_name text,
  date_of_birth date,
  company_name text,
  vat_number text,
  payment_terms_days int,
  primary_email text,
  primary_phone text,
  primary_address_id uuid references addresses(id),
  acquisition_source text,
  acquisition_campaign text,
  affiliate_id uuid references affiliates(id),
  first_contact_at timestamptz,
  marketing_consent boolean default false,
  marketing_consent_at timestamptz,
  notes text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by_id uuid references users(id),
  updated_by_id uuid references users(id),
  version int not null default 1
);
create index customers_company_id_idx on customers(company_id) where deleted_at is null;
create index customers_search_idx on customers using gin (
  (
    coalesce(first_name, '') || ' ' || coalesce(last_name, '') || ' ' ||
    coalesce(company_name, '') || ' ' || coalesce(primary_email, '') || ' ' ||
    coalesce(primary_phone, '')
  ) gin_trgm_ops
) where deleted_at is null;

create table customer_contacts (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id),
  customer_id uuid not null references customers(id) on delete cascade,
  full_name text not null,
  email text,
  phone text,
  role text,
  is_primary boolean default false,
  is_billing boolean default false,
  notes text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
  version int not null default 1
  updated_at timestamptz not null default now()
);

create table customer_relationships (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id),
  from_customer_id uuid not null references customers(id),
  to_customer_id uuid not null references customers(id),
  relationship_type text not null check (relationship_type in (
    'spouse_of', 'partner_of', 'employee_of', 'employer_of',
    'parent_of', 'child_of', 'referred_by', 'referred', 'friend_of'
  )),
  notes text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
  version int not null default 1
  updated_at timestamptz not null default now()
);

create table customer_consents (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id),
  customer_id uuid not null references customers(id),
  consent_type text not null check (consent_type in ('marketing_email', 'marketing_sms', 'marketing_whatsapp')),
  consent_state boolean not null,
  source_url text,
  ip_address inet,
  user_agent text,
  recorded_at timestamptz not null default now()
);

-- =====================================================
-- C. Jobs (Phase 2/4)
-- =====================================================

-- =====================================================
-- Job stage enum — CANONICAL list. Matches STATE_MACHINE.md exactly.
-- 13 stages: 4 pre-quote, 5 active, 2 closed-won, 3 closed-lost.
-- Display labels and transition rules live in STATE_MACHINE.md, not here.
-- =====================================================
create type job_stage as enum (
  -- Pre-quote (lead funnel)
  'lead',              -- new enquiry, not yet contacted
  'contacted',         -- initial outreach made (call/email/whatsapp)
  'survey_scheduled',  -- video or in-person survey booked
  'quoted',            -- quote sent, awaiting customer decision

  -- Active (post-acceptance)
  'accepted',          -- customer accepted quote, awaiting deposit
  'confirmed',         -- deposit paid, job locked in calendar
  'in_progress',       -- crew on site (or between split-day moves)
  'completed',         -- physical job done, awaiting final invoice/payment
  'invoiced',          -- final invoice issued, awaiting payment

  -- Closed-won
  'paid',              -- final payment received, job archived

  -- Closed-lost
  'declined',          -- customer rejected the quote
  'dead',              -- enquiry stopped responding (no quote sent or no answer post-quote)
  'cancelled'          -- customer cancelled after acceptance (deposit refund handling per case)
);
comment on type job_stage is
  'Canonical job lifecycle. Display labels, transition rules, required fields, and storage-track branching defined in STATE_MACHINE.md. Do not edit this enum without updating STATE_MACHINE.md and running the state-machine compliance test in CI.';

create table jobs (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id),
  job_number text not null,
  customer_id uuid not null references customers(id),
  primary_contact_id uuid references customer_contacts(id),
  stage job_stage not null default 'lead',
  sub_status text,
  decline_reason text,
  acquisition_source text,
  affiliate_id uuid references affiliates(id),
  assigned_to_id uuid references users(id),
  surveyor_id uuid references users(id),
  enquiry_at timestamptz,
  move_date timestamptz,
  -- v2.1: stage entry timestamps (canonical per STATE_MACHINE.md §3)
  contacted_at timestamptz,
  survey_at timestamptz,
  quoted_at timestamptz,
  accepted_at timestamptz,
  confirmed_at timestamptz,
  in_progress_at timestamptz,
  completed_at timestamptz,
  invoiced_at timestamptz,
  paid_at timestamptz,
  declined_at timestamptz,
  dead_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  deposit_refund_decision text check (deposit_refund_decision in ('refund_full', 'refund_partial', 'retain_per_terms') or deposit_refund_decision is null),
  -- v2.1: re-engagement link (a closed-lost job spawning a new live job)
  parent_job_id uuid references jobs(id),
  -- v2.1: SLA tracking (ADR-016)
  first_response_due_at timestamptz,  -- set on lead create: enquiry_at + sla_minutes
  first_response_at timestamptz,      -- set on first contact (call/email/whatsapp logged)
  -- v2.1: profit-by-job manual cost tracking (ADR-019)
  actual_crew_cost_pence int,         -- entered by admin after job completion
  actual_van_cost_pence int,
  passthrough_costs_pence int,        -- tolls, parking, packing materials, congestion charges
  profit_review_status text not null default 'pending' check (profit_review_status in ('pending', 'reviewed', 'finalized')),
  profit_review_completed_by_id uuid references users(id),
  profit_review_completed_at timestamptz,
  estimated_hours numeric,
  estimated_cubic_ft numeric,
  estimated_distance_miles numeric,
  quote_total_pence int,
  notes text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by_id uuid references users(id),
  updated_by_id uuid references users(id),
  version int not null default 1,
  unique (company_id, job_number)
);
create index jobs_stage_idx on jobs(company_id, stage, updated_at desc) where deleted_at is null;
create index jobs_customer_idx on jobs(customer_id, created_at desc) where deleted_at is null;
create index jobs_assigned_to_idx on jobs(assigned_to_id, stage) where deleted_at is null;
create index jobs_move_date_idx on jobs(move_date) where deleted_at is null and stage in ('confirmed', 'in_progress');
-- v2.1: SLA dashboard index — overdue first-response leads
create index jobs_sla_overdue_idx on jobs(company_id, first_response_due_at)
  where deleted_at is null and first_response_at is null and stage in ('lead', 'contacted');
-- v2.1: profit-review queue index
create index jobs_profit_review_idx on jobs(company_id, profit_review_status, completed_at)
  where deleted_at is null and stage in ('completed', 'invoiced', 'paid') and profit_review_status = 'pending';
-- v2.1: parent_job re-engagement chain
create index jobs_parent_idx on jobs(parent_job_id) where parent_job_id is not null;

create table job_addresses (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null,
  job_id uuid not null references jobs(id) on delete cascade,
  address_id uuid not null references addresses(id),
  role text not null check (role in ('from', 'to', 'via')),
  sequence int default 0,
  property_type text,           -- 'house', 'flat', 'studio', 'office'
  floor int,
  has_lift boolean,
  has_parking boolean,
  access_notes text,
  deleted_at timestamptz
  version int not null default 1
  updated_at timestamptz not null default now()
);

create table job_status_history (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null,
  job_id uuid not null references jobs(id),
  from_stage job_stage,
  to_stage job_stage not null,
  from_sub_status text,
  to_sub_status text,
  changed_by_id uuid references users(id),
  reason text,
  changed_at timestamptz not null default now()
);
create index job_status_history_job_idx on job_status_history(job_id, changed_at desc);

create table job_tags (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null,
  job_id uuid not null references jobs(id),
  tag text not null,
  added_by_id uuid references users(id),
  added_at timestamptz not null default now()
);
create unique index job_tags_unique on job_tags(job_id, tag);

-- =====================================================
-- D. Pricing & Quotes (Phase 5/6)
-- =====================================================

create table pricing_versions (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id),
  version_label text not null,
  effective_from timestamptz not null,
  effective_to timestamptz,
  margin_matrix jsonb not null,
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
  created_at timestamptz not null default now(),
  deleted_at timestamptz
  version int not null default 1
  updated_at timestamptz not null default now()
);
create unique index pricing_versions_active_idx on pricing_versions(company_id) where effective_to is null;

create table quotes (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null,
  job_id uuid not null references jobs(id),
  pricing_version_id uuid not null references pricing_versions(id),
  pricing_snapshot jsonb not null,
  size_code text,
  distance_miles numeric,
  complications text[],
  total_pence int not null,
  breakdown jsonb,
  status text check (status in ('draft', 'sent', 'accepted', 'declined', 'expired')) default 'draft',
  valid_until timestamptz not null,
  pdf_url text,
  sent_at timestamptz,
  notes text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by_id uuid references users(id),
  version int not null default 1
);

create table quote_variants (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null,
  quote_id uuid not null references quotes(id) on delete cascade,
  variant_label text not null,
  total_pence int not null,
  description text,
  display_order int default 0
);

create table quote_acceptances (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null,
  quote_id uuid not null references quotes(id),
  variant_id uuid references quote_variants(id),
  customer_id uuid not null references customers(id),
  accepted_at timestamptz not null default now(),
  ip_address inet not null,
  user_agent text,
  signature_image_url text,
  acceptance_token text not null,
  consents jsonb,
  notes text
);

-- =====================================================
-- E. Capacity (Phase 7)
-- =====================================================

create table capacity_overrides (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id),
  date date not null,
  forced_band text check (forced_band in ('green', 'yellow', 'red', 'closed')),
  reason text not null,
  applied_by_id uuid references users(id),
  applied_at timestamptz default now()
);
create unique index capacity_overrides_unique on capacity_overrides(company_id, date);

-- =====================================================
-- F. Resources (Phase 8)
-- =====================================================

create table vehicles (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id),
  registration text not null,
  type text check (type in ('luton', 'transit', '7.5t', '18t', 'trailer', 'car')),
  capacity_cubic_ft numeric,
  monthly_cost_pence int,
  active boolean default true,
  compliance_alerts_enabled boolean default true,
  mot_due date,
  tax_due date,
  insurance_due date,
  next_service_due date,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version int not null default 1,
  unique (company_id, registration)
);

create table vehicle_assignments (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null,
  vehicle_id uuid not null references vehicles(id),
  date date not null,
  driver_id uuid references workers(id),
  daily_reviewer_id uuid references workers(id),
  notes text,
  created_at timestamptz default now(),
  unique (vehicle_id, date)
);

create table worker_availability (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null,
  worker_id uuid not null references workers(id),
  date date not null,
  available boolean not null,
  notes text,
  submitted_at timestamptz default now(),
  unique (worker_id, date)
);

create table job_assignments (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null,
  job_id uuid not null references jobs(id),
  worker_id uuid not null references workers(id),
  vehicle_id uuid references vehicles(id),
  date date not null,
  role text check (role in ('lead_loader', 'loader', 'driver', 'surveyor')),
  scheduled_start time,
  scheduled_end time,
  notes text,
  created_at timestamptz default now(),
  deleted_at timestamptz
  version int not null default 1
  updated_at timestamptz not null default now()
);

create table storage_sites (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id),
  name text not null,
  address_id uuid not null references addresses(id),
  total_containers int,
  active boolean default true,
  notes text,
  created_at timestamptz default now()
);

create table storage_containers (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null,
  storage_site_id uuid not null references storage_sites(id),
  container_code text not null,
  size_cubic_ft numeric,
  monthly_rate_pence int not null,
  status text check (status in ('available', 'reserved', 'occupied', 'maintenance')) default 'available',
  notes text,
  unique (storage_site_id, container_code),
  deleted_at timestamptz
  version int not null default 1
  updated_at timestamptz not null default now()
);

create table storage_rentals (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null,
  customer_id uuid not null references customers(id),
  storage_container_id uuid not null references storage_containers(id),
  start_date date not null,
  end_date date,
  monthly_rate_pence int not null,
  status text check (status in ('pending', 'active', 'terminated')) default 'pending',
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  version int not null default 1,
  deleted_at timestamptz
);

-- =====================================================
-- G. Operations (Phases 9/10)
-- =====================================================

create table time_entries (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null,
  job_id uuid not null references jobs(id),
  worker_id uuid not null references workers(id),
  type text check (type in ('clock_in', 'load_start', 'load_end', 'unload_start', 'unload_end', 'clock_out', 'break_start', 'break_end')),
  occurred_at timestamptz not null,
  gps_lat numeric(10, 7),
  gps_lng numeric(10, 7),
  gps_accuracy_m numeric,
  distance_from_job_address_m numeric,
  flagged boolean default false,
  notes text,
  created_at timestamptz default now(),
  deleted_at timestamptz
  version int not null default 1
  updated_at timestamptz not null default now()
);
create index time_entries_job_idx on time_entries(job_id, occurred_at);
create index time_entries_worker_period_idx on time_entries(worker_id, occurred_at desc);

create table vehicle_checks (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null,
  vehicle_id uuid not null references vehicles(id),
  job_id uuid references jobs(id),
  worker_id uuid not null references workers(id),
  date date not null,
  fuel_level int check (fuel_level between 0 and 100),
  mileage int,
  walk_around_clear boolean,
  defects_noted text,
  dashboard_photo_url text,
  signature_data_url text,
  submitted_at timestamptz default now(),
  deleted_at timestamptz
  version int not null default 1
  updated_at timestamptz not null default now()
);

create table photos (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null,
  job_id uuid not null references jobs(id),
  uploaded_by_worker_id uuid references workers(id),
  uploaded_by_user_id uuid references users(id),
  category text check (category in ('before', 'during', 'after', 'damage', 'inventory', 'paperwork')),
  url text not null,
  thumbnail_url text,
  notes text,
  taken_at timestamptz,
  uploaded_at timestamptz default now(),
  deleted_at timestamptz
  version int not null default 1
  updated_at timestamptz not null default now()
);

create table surveys (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null,
  job_id uuid not null references jobs(id),
  surveyor_id uuid references users(id),
  survey_type text check (survey_type in ('video_self', 'video_live', 'in_person', 'estimate_only')),
  scheduled_at timestamptz,
  completed_at timestamptz,
  cubic_ft_estimate numeric,
  cubic_ft_ai_estimate numeric,
  cubic_ft_confidence text check (cubic_ft_confidence in ('low', 'medium', 'high')),
  complications jsonb default '[]',
  notes_internal text,
  notes_for_customer text,
  source_video_url text,
  ai_analysis jsonb,
  created_at timestamptz default now(),
  deleted_at timestamptz
  version int not null default 1
  updated_at timestamptz not null default now()
);

create table cubic_sheet_items (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null,
  survey_id uuid not null references surveys(id) on delete cascade,
  room text,
  item text not null,
  quantity int default 1,
  cubic_ft_each numeric not null,
  cubic_ft_total numeric generated always as (quantity * cubic_ft_each) stored,
  fragile boolean default false,
  dismantle_required boolean default false,
  notes text
);

create table job_sheets (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null,
  job_id uuid not null references jobs(id),
  worker_id uuid not null references workers(id),
  actual_hours numeric not null,
  actual_cubic_ft numeric,
  materials_used jsonb,
  complications_encountered text,
  damage_reported boolean default false,
  damage_details text,
  customer_satisfaction_score int check (customer_satisfaction_score between 1 and 10),
  submitted_at timestamptz default now(),
  deleted_at timestamptz
  version int not null default 1
  updated_at timestamptz not null default now()
);

create table notes (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null,
  parent_type text check (parent_type in ('customer', 'job', 'storage_rental')),
  parent_id uuid not null,
  category text check (category in ('admin', 'staff', 'customer_visible')) default 'admin',
  body text not null,
  body_html text,
  mentions uuid[],
  created_by_id uuid references users(id),
  created_at timestamptz default now(),
  edited_at timestamptz,
  pinned boolean default false,
  deleted_at timestamptz
  version int not null default 1
  updated_at timestamptz not null default now(),
  -- v2.1: split internal-ops notes from customer-visible notes
  is_customer_visible boolean not null default false
);
create index notes_parent_idx on notes(parent_type, parent_id, created_at desc);

-- =====================================================
-- H. Sign-off & Reviews (Phase 11)
-- =====================================================

create table customer_signoffs (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null,
  job_id uuid not null references jobs(id),
  customer_id uuid not null references customers(id),
  signed_at timestamptz default now(),
  signature_data_url text not null,
  satisfaction_score int check (satisfaction_score between 0 and 10),
  feedback_text text,
  ip_address inet,
  user_agent text,
  device_lat numeric(10, 7),
  device_lng numeric(10, 7),
  collected_by_worker_id uuid references workers(id),
  deleted_at timestamptz
  version int not null default 1
  updated_at timestamptz not null default now(),
  -- v2.1: internal-only satisfaction rating (never sent externally, never gates anything)
  internal_rating_1_5 int check (internal_rating_1_5 between 1 and 5 or internal_rating_1_5 is null),
  customer_email_confirmed_at timestamptz  -- customer confirmed they want a follow-up
);

create table review_requests (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null,
  signoff_id uuid not null references customer_signoffs(id),
  customer_id uuid not null references customers(id),
  channel text check (channel in ('email', 'sms', 'whatsapp')),
  sent_at timestamptz default now(),
  clicked_at timestamptz,
  review_left_at timestamptz,
  review_url text,
  nudge_count int default 0,
  status text check (status in ('pending', 'clicked', 'reviewed', 'expired')),
  deleted_at timestamptz
  version int not null default 1
  updated_at timestamptz not null default now(),
  -- v2.1: universal review request fields (no NPS gating, see ADR-010)
  internal_rating_1_5 int check (internal_rating_1_5 between 1 and 5 or internal_rating_1_5 is null),  -- ops only
  google_review_link_clicked_at timestamptz,
  complaints_link_clicked_at timestamptz,
  responded_at timestamptz,  -- either link clicked OR external GMB review detected
  followup_count int not null default 0  -- max 2 (at +7d and +14d)
);

create table complaints (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null,
  job_id uuid not null references jobs(id),
  customer_id uuid not null references customers(id),
  source text check (source in ('signoff_detractor', 'signoff_passive', 'email', 'phone', 'other')),
  description text not null,
  severity text check (severity in ('low', 'medium', 'high', 'critical')),
  status text check (status in ('new', 'investigating', 'resolved', 'escalated')),
  assigned_to_id uuid references users(id),
  resolution_notes text,
  resolved_at timestamptz,
  created_at timestamptz default now(),
  deleted_at timestamptz
  version int not null default 1
  updated_at timestamptz not null default now(),
  -- v2.1: customer-self-assessed severity + first-response SLA (24h)
  severity_self_assessed text check (severity_self_assessed in ('minor', 'needs_fix', 'major') or severity_self_assessed is null),
  sla_first_response_due_at timestamptz,
  sla_first_response_at timestamptz,
  escalated_at timestamptz,  -- set if not resolved within 7 days
);

create table damage_claims (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null,
  job_id uuid not null references jobs(id),
  reported_by_worker_id uuid references workers(id),
  reported_by_customer boolean default false,
  description text not null,
  estimated_value_pence int,
  insurance_claim_ref text,
  payout_pence int,
  status text check (status in ('reported', 'investigating', 'agreed', 'paid', 'denied')),
  photos jsonb default '[]',
  repeat_claim_flag boolean default false,
  auto_escalated boolean default false,
  created_at timestamptz default now(),
  resolved_at timestamptz,
  deleted_at timestamptz
  version int not null default 1
  updated_at timestamptz not null default now()
);

-- =====================================================
-- I. Money (Phase 12)
-- =====================================================

create table invoices (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null,
  job_id uuid references jobs(id),
  customer_id uuid not null references customers(id),
  storage_rental_id uuid references storage_rentals(id),
  invoice_number text not null,
  type text check (type in ('deposit', 'custom', 'final', 'storage_recurring', 'storage_initial', 'credit_note')),
  status text check (status in ('draft', 'sent', 'paid', 'partial', 'overdue', 'void')),
  subtotal_pence int not null,
  vat_pence int not null default 0,
  total_pence int not null,
  amount_paid_pence int default 0,
  amount_outstanding_pence int generated always as (total_pence - coalesce(amount_paid_pence, 0)) stored,
  issued_at timestamptz,
  due_at timestamptz,
  xero_id text unique,
  xero_synced_at timestamptz,
  xero_sync_error text,
  email_sent_at timestamptz,
  email_opened_at timestamptz,
  email_message_id text,
  created_by_id uuid references users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  version int default 1,
  deleted_at timestamptz,
  unique (company_id, invoice_number)
);

create table invoice_lines (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id),  -- denormalized for tenant isolation + RLS perf
  invoice_id uuid not null references invoices(id) on delete cascade,
  description text not null,
  quantity numeric not null default 1,
  unit_price_pence int not null,
  vat_rate numeric(5,2) default 20.00,
  line_total_pence int not null,
  sort_order int default 0,
  deleted_at timestamptz
  version int not null default 1
  updated_at timestamptz not null default now()
);
create index invoice_lines_invoice_idx on invoice_lines(invoice_id);
create index invoice_lines_company_idx on invoice_lines(company_id);
-- Trigger to auto-set company_id from parent invoice (defensive)
create or replace function set_invoice_lines_company_id() returns trigger as $$
begin
  if NEW.company_id is null then
    select company_id into NEW.company_id from invoices where id = NEW.invoice_id;
  end if;
  return NEW;
end;
$$ language plpgsql;
create trigger invoice_lines_company_id_trg before insert on invoice_lines
  for each row execute function set_invoice_lines_company_id();

create table payments (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null,
  customer_id uuid not null references customers(id),
  amount_pence int not null check (amount_pence > 0),
  method text check (method in ('bank_transfer', 'card', 'direct_debit', 'cash', 'cheque', 'other')),
  occurred_at timestamptz not null,
  reference text,
  -- NOTE: invoice_id is intentionally removed from this row — payments are now
  -- linked to invoices via the payment_allocations table (a payment can cover
  -- multiple invoices, an invoice can receive multiple payments).
  xero_id text unique,
  source text check (source in ('xero_sync', 'gocardless_webhook', 'manual')),
  notes text,
  created_at timestamptz default now(),
  created_by_id uuid references users(id),
  updated_at timestamptz default now(),
  updated_by_id uuid references users(id),
  deleted_at timestamptz,
  version int not null default 1
);
create index payments_customer_idx on payments(customer_id);
create index payments_occurred_idx on payments(company_id, occurred_at desc);

-- Payment allocations (accounting-grade): a payment can be split across
-- multiple invoices, partial payments, write-offs, refunds, credit notes.
-- This replaces the previous JSONB approach which was not queryable for
-- "what is the unallocated balance on payment X" or "what payments touched invoice Y".
create table payment_allocations (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id),
  payment_id uuid not null references payments(id) on delete restrict,
  invoice_id uuid references invoices(id) on delete restrict,
  -- One of: payment-to-invoice allocation, refund, write-off, credit note application
  allocation_type text not null check (allocation_type in (
    'payment_to_invoice',
    'refund',
    'write_off',
    'credit_note_applied',
    'overpayment_held'  -- excess held as customer credit until next invoice
  )),
  amount_pence int not null,  -- positive for allocation, negative for refund/write-off
  allocated_at timestamptz not null default now(),
  allocated_by_id uuid references users(id),
  notes text,
  -- For overpayment/credit movements, link to the originating allocation
  reverses_allocation_id uuid references payment_allocations(id),
  created_at timestamptz default now()
);
create index pa_payment_idx on payment_allocations(payment_id);
create index pa_invoice_idx on payment_allocations(invoice_id);
create index pa_company_idx on payment_allocations(company_id);

-- View: unallocated balance per payment
create or replace view payments_with_balance as
select
  p.*,
  p.amount_pence - coalesce((
    select sum(amount_pence) from payment_allocations
    where payment_id = p.id and allocation_type != 'overpayment_held'
  ), 0) as unallocated_pence
from payments p
where p.deleted_at is null;

create table direct_debit_mandates (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null,
  customer_id uuid not null references customers(id),
  storage_rental_id uuid references storage_rentals(id),
  gocardless_mandate_id text unique not null,
  status text check (status in ('pending', 'active', 'cancelled', 'failed', 'expired')),
  bank_name text,
  account_holder_name text,
  account_last4 text,
  set_up_at timestamptz,
  cancelled_at timestamptz,
  cancelled_reason text,
  deleted_at timestamptz
  version int not null default 1
  updated_at timestamptz not null default now()
);

-- =====================================================
-- J. Communications (Phase 13)
-- =====================================================

create table email_templates (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null,
  name text not null,
  category text,
  subject_template text not null,
  body_template text not null,
  body_html_template text,
  variables_schema jsonb,
  active boolean default true,
  created_by_id uuid references users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table sms_templates (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null,
  name text not null,
  body_template text not null,
  active boolean default true,
  created_at timestamptz default now()
);

create table whatsapp_templates (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null,
  name text not null,
  meta_template_id text unique,
  meta_template_status text check (meta_template_status in ('pending', 'approved', 'rejected')),
  body_template text not null,
  variables_schema jsonb,
  category text check (category in ('marketing', 'utility', 'authentication')),
  language text default 'en',
  created_at timestamptz default now()
);

create table automation_rules (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null,
  name text not null,
  trigger_event text not null,
  trigger_filters jsonb,
  delay_seconds int default 0,
  action_type text check (action_type in ('send_email', 'send_sms', 'send_whatsapp', 'create_task', 'webhook')),
  action_config jsonb not null,
  active boolean default true,
  last_run_at timestamptz,
  run_count int default 0,
  created_by_id uuid references users(id),
  created_at timestamptz default now()
);

create table automation_queue (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null,
  rule_id uuid not null references automation_rules(id),
  trigger_event text not null,
  payload jsonb,
  scheduled_for timestamptz not null,
  processed_at timestamptz,
  result text check (result in ('success', 'failed', 'skipped')),
  error_message text,
  created_at timestamptz default now()
);
create index automation_queue_due_idx on automation_queue(scheduled_for) where processed_at is null;

create table messages (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null,
  customer_id uuid references customers(id),
  job_id uuid references jobs(id),
  channel text check (channel in ('email', 'sms', 'whatsapp', 'phone')),
  direction text check (direction in ('outbound', 'inbound')),
  template_id uuid,
  subject text,
  body text not null,
  body_html text,
  provider text,
  provider_message_id text,
  status text,
  from_address text,
  to_address text,
  sent_by_user_id uuid references users(id),
  in_reply_to_message_id uuid references messages(id),
  thread_id uuid,
  sent_at timestamptz default now(),
  delivered_at timestamptz,
  opened_at timestamptz,
  replied_at timestamptz,
  raw_payload jsonb,
  created_at timestamptz default now()
);
create index messages_customer_idx on messages(customer_id, sent_at desc);
create index messages_job_idx on messages(job_id, sent_at desc);
create index messages_thread_idx on messages(thread_id);

create table phone_calls (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null,
  customer_id uuid references customers(id),
  job_id uuid references jobs(id),
  direction text check (direction in ('inbound', 'outbound')),
  caller_number text,
  called_number text,
  duration_seconds int,
  recording_url text,
  user_id uuid references users(id),
  notes text,
  source text check (source in ('tamar_email', 'tamar_api', 'manual')),
  occurred_at timestamptz not null,
  created_at timestamptz default now()
);

-- =====================================================
-- K. Affiliates & Attribution (Phase 16)
-- =====================================================

create table affiliate_codes (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null,
  affiliate_id uuid not null references affiliates(id),
  code text unique not null,
  active boolean default true,
  created_at timestamptz default now()
);

create table attributions (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null,
  job_id uuid references jobs(id),
  customer_id uuid references customers(id),
  affiliate_id uuid references affiliates(id),
  affiliate_code text,
  source text,
  campaign text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  gclid text,
  fbclid text,
  landing_page text,
  attributed_at timestamptz default now()
);
create index attributions_affiliate_idx on attributions(affiliate_id);
create index attributions_job_idx on attributions(job_id);

create table commission_records (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null,
  affiliate_id uuid not null references affiliates(id),
  job_id uuid not null references jobs(id),
  amount_pence int not null,
  status text check (status in ('pending', 'approved', 'paid', 'cancelled')),
  invoice_id uuid references invoices(id),
  approved_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz default now()
);

-- =====================================================
-- L. Notifications & Presence (Phase 15)
-- =====================================================

create table notifications (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null,
  recipient_user_id uuid not null references users(id),
  type text not null,
  title text not null,
  body text,
  link_url text,
  related_entity_type text,
  related_entity_id uuid,
  read_at timestamptz,
  delivered_channels text[],
  priority text check (priority in ('low', 'normal', 'high', 'urgent')) default 'normal',
  created_at timestamptz default now()
);
create index notifications_recipient_idx on notifications(recipient_user_id, created_at desc) where read_at is null;

create table notification_preferences (
  user_id uuid primary key references users(id),
  company_id uuid not null references companies(id),  -- denormalized for tenant isolation + RLS perf
  email_digest_enabled boolean default true,
  email_digest_time time default '08:00',
  push_enabled boolean default true,
  push_subscriptions jsonb default '[]',
  channels jsonb default '{}',
  updated_at timestamptz default now()
);
create index notif_prefs_company_idx on notification_preferences(company_id);

create table presence (
  user_id uuid not null references users(id),
  company_id uuid not null references companies(id),  -- denormalized for tenant isolation + RLS perf
  entity_type text not null,
  entity_id uuid not null,
  last_seen_at timestamptz not null default now(),
  primary key (user_id, entity_type, entity_id)
);
create index presence_entity_idx on presence(entity_type, entity_id, last_seen_at desc);
create index presence_company_idx on presence(company_id);

-- =====================================================
-- M. Reporting (Phase 14)
-- =====================================================

create table offline_conversion_uploads (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null,
  job_id uuid not null references jobs(id),
  network text check (network in ('google_ads', 'meta')),
  conversion_type text,
  conversion_value_pence int not null,
  conversion_currency text default 'GBP',
  click_id text,
  uploaded_at timestamptz,
  upload_status text check (upload_status in ('queued', 'uploaded', 'failed', 'skipped_no_click_id')),
  upload_response jsonb,
  retry_count int default 0,
  created_at timestamptz default now()
);

-- =====================================================
-- N. Webhooks (Phase 5)
-- =====================================================

create table webhook_events (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid,
  source text not null,
  event_id text not null,
  event_type text not null,
  payload jsonb not null,
  processed_at timestamptz,
  result text check (result in ('success', 'duplicate', 'failed')),
  error_message text,
  received_at timestamptz default now(),
  unique (source, event_id)
);
create index webhook_events_received_at_idx on webhook_events(received_at desc);
-- For replay-protection auditing (see SECURITY_MODEL.md)
create index webhook_events_signature_idx on webhook_events(source, received_at desc);

-- =====================================================


-- =====================================================
-- P. Documents (v2.1 - Document vault, ADR-018)
-- =====================================================
-- Polymorphic document vault: T&C acceptance, parking permits,
-- insurance docs, signed quotes, customer-uploaded floor plans, etc.
-- One row per document; parent is one of customer/job/quote/invoice.
-- File itself in Supabase Storage; this table holds metadata.

create table documents (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id),
  -- Polymorphic parent. Exactly one of these must be set (CHECK below).
  parent_customer_id uuid references customers(id),
  parent_job_id uuid references jobs(id),
  parent_quote_id uuid references quotes(id),
  parent_invoice_id uuid references invoices(id),
  -- Classification
  document_type text not null check (document_type in (
    'terms_accepted', 'parking_permit', 'insurance_certificate',
    'signed_quote_pdf', 'invoice_pdf', 'floor_plan',
    'inventory_list', 'damage_report', 'identification', 'other'
  )),
  -- File data
  file_name text not null,
  storage_path text not null,            -- supabase storage key
  file_size_bytes bigint not null,
  mime_type text not null,
  sha256 text,                            -- for dedup + integrity
  -- Provenance
  uploaded_by_id uuid references users(id),
  uploaded_by_customer boolean not null default false,  -- true if from public quote-acceptance page
  uploaded_at timestamptz not null default now(),
  -- Visibility + lifecycle
  is_customer_visible boolean not null default false,  -- shown on customer self-serve page
  expires_at timestamptz,                 -- e.g., parking permit valid until
  notes text,
  deleted_at timestamptz,
  version int not null default 1,
  -- Exactly one parent
  constraint documents_one_parent check (
    (parent_customer_id is not null)::int +
    (parent_job_id is not null)::int +
    (parent_quote_id is not null)::int +
    (parent_invoice_id is not null)::int = 1
  )
);
create index documents_customer_idx on documents(parent_customer_id) where deleted_at is null and parent_customer_id is not null;
create index documents_job_idx on documents(parent_job_id) where deleted_at is null and parent_job_id is not null;
create index documents_quote_idx on documents(parent_quote_id) where deleted_at is null and parent_quote_id is not null;
create index documents_invoice_idx on documents(parent_invoice_id) where deleted_at is null and parent_invoice_id is not null;
create index documents_company_type_idx on documents(company_id, document_type) where deleted_at is null;
create index documents_expiring_idx on documents(company_id, expires_at) where deleted_at is null and expires_at is not null;

-- =====================================================
-- Q. Integration credentials (Phases 12, 14)
-- =====================================================
-- Generic OAuth/API credential storage for Xero, GoCardless, Google Ads,
-- Meta Ads, etc. Tokens encrypted at rest with pgcrypto.
-- See INTEGRATION_CONTRACTS.md for per-provider scope and refresh cadence.
-- See SECURITY_MODEL.md §Encryption for key management.

create extension if not exists pgcrypto;

create table integration_credentials (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id),
  provider text not null check (provider in (
    'xero',
    'gocardless',
    'google_ads',
    'meta_ads',
    'meta_whatsapp',
    'resend',
    'tamar_telecom',
    'liveswitch'
  )),
  -- pgcrypto encrypted bytea — encrypt/decrypt via app-layer with the
  -- INTEGRATION_ENCRYPTION_KEY env var. Never select these in regular queries —
  -- always use the get_integration_credential() RPC which logs access.
  access_token_encrypted bytea,
  refresh_token_encrypted bytea,
  expires_at timestamptz,
  scopes text[],
  -- Provider-specific identifiers (Xero tenant ID, Meta ad account ID, etc.)
  external_account_id text,
  external_account_name text,
  metadata jsonb default '{}',
  -- Lifecycle
  status text not null check (status in ('active', 'expired', 'revoked', 'pending')) default 'pending',
  connected_at timestamptz,
  connected_by_id uuid references users(id),
  disconnected_at timestamptz,
  disconnected_reason text,
  last_used_at timestamptz,
  last_refresh_at timestamptz,
  refresh_failure_count int not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (company_id, provider, external_account_id),
  deleted_at timestamptz
  version int not null default 1
);
create index ic_company_provider_idx on integration_credentials(company_id, provider) where status = 'active';
create index ic_expires_idx on integration_credentials(expires_at) where status = 'active' and expires_at is not null;

-- Audit log for credential access (separate from activity_log because we don't
-- want token bodies in the main audit table).
create table integration_credential_access_log (
  id bigserial primary key,
  company_id uuid not null,
  credential_id uuid not null references integration_credentials(id) on delete cascade,
  accessed_at timestamptz default now(),
  accessed_by_id uuid references users(id),
  reason text,            -- e.g., 'xero_invoice_create', 'token_refresh', 'manual_test'
  ip_address inet,
  user_agent text
);
create index icl_credential_idx on integration_credential_access_log(credential_id, accessed_at desc);
create index icl_company_idx on integration_credential_access_log(company_id, accessed_at desc);

-- =====================================================
-- RLS — apply to every table
-- =====================================================
-- See references/rls-patterns.md for the full template library.
-- Pattern: every table gets `tenant_isolation` policy filtering by company_id.

-- =====================================================
-- RPC Functions (selected)
-- =====================================================

create or replace function customer_lifetime_value(p_customer_id uuid)
returns bigint language sql stable security definer as $$
  -- Net LTV: gross payments minus refunds/write-offs recorded as allocations.
  -- Overpayment_held does NOT reduce LTV (the money is still ours, just unallocated).
  select (
    coalesce((
      select sum(amount_pence) from payments
      where customer_id = p_customer_id
        and company_id = current_user_company_id()
        and deleted_at is null
    ), 0)
    +
    coalesce((
      -- payment_allocations: refunds/write-offs are stored as negative amount_pence
      select sum(pa.amount_pence) from payment_allocations pa
      join payments p on p.id = pa.payment_id
      where p.customer_id = p_customer_id
        and pa.company_id = current_user_company_id()
        and pa.allocation_type in ('refund', 'write_off')
    ), 0)
  )::bigint
$$;
comment on function customer_lifetime_value is
  'Net lifetime value in pence. Gross payments minus refunds and write-offs. Overpayments-held do not reduce LTV (the money is still company-side, just unallocated to invoices).';

create or replace function find_duplicate_candidates(
  p_email text default null,
  p_phone text default null,
  p_postcode text default null
)
returns setof customers language sql stable security definer as $$
  select c.* from customers c
  left join addresses a on a.id = c.primary_address_id
  where c.company_id = current_user_company_id()
    and c.deleted_at is null
    and (
      (p_email is not null and c.primary_email = p_email)
      or (p_phone is not null and c.primary_phone = p_phone)
      or (p_postcode is not null and a.postcode = p_postcode)
    )
$$;

-- =====================================================
-- End of schema
-- =====================================================
