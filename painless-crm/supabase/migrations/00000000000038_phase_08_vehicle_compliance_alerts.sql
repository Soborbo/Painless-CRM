-- ============================================================
-- Phase 08: vehicle compliance alert ledger
-- ============================================================
-- The daily compliance-reminder cron emails admins 30/14/7 days before each
-- vehicle's MOT / road tax / insurance / next-service expiry. This table is the
-- dedupe ledger: one row per (vehicle, field, due_date, threshold) the moment an
-- alert is sent, so the cron never re-sends the same reminder — even if it runs
-- more than once a day or a run is retried.
-- ============================================================

create table if not exists vehicle_compliance_alerts (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id),
  vehicle_id uuid not null references vehicles(id),
  field text not null check (field in ('mot', 'tax', 'insurance', 'service')),
  due_date date not null,
  threshold int not null check (threshold in (30, 14, 7)),
  sent_at timestamptz not null default now(),
  unique (vehicle_id, field, due_date, threshold)
);

create index if not exists vehicle_compliance_alerts_company_idx
  on vehicle_compliance_alerts (company_id);

-- Tenant isolation (Pattern 1). The cron writes via the service-role client
-- (RLS bypassed); this policy scopes any future user-facing reads.
alter table vehicle_compliance_alerts enable row level security;

drop policy if exists vehicle_compliance_alerts_tenant on vehicle_compliance_alerts;
create policy vehicle_compliance_alerts_tenant on vehicle_compliance_alerts
  for all to authenticated
  using (company_id = public.current_user_company_id())
  with check (company_id = public.current_user_company_id());
