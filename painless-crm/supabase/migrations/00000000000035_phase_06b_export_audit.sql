-- ============================================================
-- Phase 06b §8: Export audit log — ADR-021
-- ============================================================
-- SECURITY_MODEL.md T4 (insider bulk-export) requires that "large export
-- operations [are] audit-logged with row counts". The main `activity_log`
-- table is trigger-only — `revoke insert ... from authenticated` (phase 03)
-- means app code cannot write it — and its `entity_id uuid not null` column
-- has no meaning for a list export. So, exactly like
-- `integration_credential_access_log`, export events get their own table.
--
-- This records a READ event (who pulled which resource, with what filters,
-- how many rows), kept separate from the mutation audit trail.
-- ============================================================

create table if not exists data_export_log (
  id bigserial primary key,
  company_id uuid not null references companies(id),
  exported_by_id uuid references users(id),
  resource text not null,                 -- 'customers' | 'jobs' | 'profit'
  format text not null default 'csv',     -- 'csv' | 'xlsx'
  filters jsonb not null default '{}'::jsonb,
  row_count integer not null,
  ip_address inet,
  user_agent text,
  exported_at timestamptz not null default now()
);

create index del_company_idx on data_export_log(company_id, exported_at desc);
create index del_actor_idx on data_export_log(exported_by_id, exported_at desc);

-- ----- Tenant isolation -----
-- Office users read their own tenant's export history and may append their
-- own export events (the route inserts under the caller's authenticated
-- client). Rows are immutable: no update/delete from app roles, so the trail
-- cannot be rewritten to cover tracks.

alter table data_export_log enable row level security;

drop policy if exists data_export_log_select_tenant on data_export_log;
create policy data_export_log_select_tenant on data_export_log for select to authenticated
  using (company_id = public.current_user_company_id());

drop policy if exists data_export_log_insert_tenant on data_export_log;
create policy data_export_log_insert_tenant on data_export_log for insert to authenticated
  with check (company_id = public.current_user_company_id());

revoke update, delete on data_export_log from anon, authenticated;
