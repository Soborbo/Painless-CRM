-- ============================================================
-- Review Engine brain (ADR-047) — single-tenant adoption
-- ============================================================
-- Brings the Soborbo/reviewengine "brain" into the CRM: extends the existing
-- review_requests row (Phase 11) with the cadence + crash-safe send state the
-- engine needs, and adds its supporting tables (send log, suppression, A/B
-- variants). Deliberately NOT ported: review_campaign (tenancy is the CRM's
-- company_id) and review_audit (the activity_log trigger covers audit).
-- RLS follows references/rls-patterns.md pattern 1 (+2 for soft-deleted tables).
-- See painless-crm-spec/proposals/ADR-047-review-engine-brain.md.
-- ============================================================

-- --- 1) Extend review_requests with the brain's scheduling/crash-safe state ---
alter table review_requests add column if not exists trigger_at timestamptz;
alter table review_requests add column if not exists attempts_sent int not null default 0;
alter table review_requests add column if not exists last_sent_at timestamptz;
alter table review_requests add column if not exists next_send_at timestamptz;
alter table review_requests add column if not exists clicked_review_at timestamptz;
alter table review_requests add column if not exists clicked_platform text;
alter table review_requests add column if not exists manual_reviewed boolean not null default false;

-- Widen the status set to the engine lifecycle. Map the old values first so the
-- new CHECK validates cleanly (no silent drops): a clicked request reviewed,
-- an expired one exhausted. 'pending'/'reviewed' exist in both sets.
update review_requests set status = 'reviewed' where status = 'clicked';
update review_requests set status = 'exhausted' where status = 'expired';

alter table review_requests drop constraint if exists review_requests_status_check;
alter table review_requests
  add constraint review_requests_status_check
  check (
    status in ('pending', 'active', 'reviewed', 'complained', 'unsubscribed', 'exhausted')
  );

-- Due-scan index for the hourly sweep.
create index if not exists review_requests_due_idx
  on review_requests (company_id, status, attempts_sent, next_send_at)
  where deleted_at is null;

-- --- 2) Crash-safe send log (claim -> send -> confirm; UNIQUE idempotency) ---
create table if not exists review_send_log (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null,
  request_id uuid not null references review_requests(id),
  attempt_no int not null,
  channel text not null default 'email',
  template_id text not null,
  variant_id uuid,
  idempotency_key text not null unique,
  provider_id text, -- null = claimed but unconfirmed (in-flight / failed)
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists review_send_log_request_idx on review_send_log (request_id);
create index if not exists review_send_log_unconfirmed_idx
  on review_send_log (provider_id, sent_at);

-- --- 3) Email suppression (hard bounce / spam / unsubscribe -> never email) ---
create table if not exists review_suppression (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null,
  email text not null,
  reason text not null
    check (reason in ('hard_bounce', 'spam_complaint', 'unsubscribe', 'manual')),
  created_at timestamptz not null default now(),
  unique (company_id, email)
);
create index if not exists review_suppression_email_idx on review_suppression (company_id, email);

-- --- 4) A/B subject variants (brain picks one; dashboard UI lands in Phase 2) ---
create table if not exists review_variant (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null,
  template_key text not null,
  label text not null,
  subject text not null,
  weight int not null default 1,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version int not null default 1,
  deleted_at timestamptz
);
create index if not exists review_variant_pick_idx
  on review_variant (company_id, template_key)
  where active and deleted_at is null;

create trigger review_variant_set_updated_at
  before update on review_variant
  for each row execute function set_updated_at();

-- --- 5) RLS (rls-patterns.md pattern 1; service-role writes bypass RLS) ---
alter table review_send_log enable row level security;
create policy review_send_log_tenant on review_send_log
  for all to authenticated
  using (company_id = current_user_company_id())
  with check (company_id = current_user_company_id());

alter table review_suppression enable row level security;
create policy review_suppression_tenant on review_suppression
  for all to authenticated
  using (company_id = current_user_company_id())
  with check (company_id = current_user_company_id());

alter table review_variant enable row level security;
create policy review_variant_tenant on review_variant
  for all to authenticated
  using (company_id = current_user_company_id() and deleted_at is null)
  with check (company_id = current_user_company_id());
