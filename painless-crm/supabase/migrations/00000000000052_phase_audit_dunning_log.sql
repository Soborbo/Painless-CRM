-- Audit fix M4 — dunning idempotency ledger.
--
-- The dunning sweep was stateless and fired a reminder only on an EXACT
-- days-overdue match, so a missed cron day skipped that stage forever, while a
-- same-day re-run re-sent every due reminder. This ledger records (invoice,
-- stage) once; the sweep inserts before sending and skips on the unique
-- conflict, making each stage exactly-once and letting the stage logic move to
-- "highest mark <= days overdue" (miss-resilient) without re-sending.

create table if not exists dunning_log (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null,
  invoice_id uuid not null references invoices(id) on delete cascade,
  stage text not null,
  sent_at timestamptz not null default now(),
  unique (invoice_id, stage)
);
create index if not exists dunning_log_invoice_idx on dunning_log(invoice_id);
create index if not exists dunning_log_company_idx on dunning_log(company_id);

alter table dunning_log enable row level security;

-- Read-only to the owning tenant for any future admin UI. Writes happen only via
-- the service-role dunning cron (which bypasses RLS), so no authenticated
-- insert/update policy is granted — deny by default.
drop policy if exists dunning_log_select_tenant on dunning_log;
create policy dunning_log_select_tenant on dunning_log for select to authenticated
  using (company_id = public.current_user_company_id());
