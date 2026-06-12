-- Phase 17 — Legacy (iMVE) import support columns.
-- See ADR-040 and painless-crm-spec/MIGRATION_MAPPING.md.
--
-- Two iMVE job fields have no canonical home in the domain schema:
--   * the move END date (multi-day moves — iMVE has start+end, we only had move_date)
--   * the iMVE "Job Name" / label (e.g. "Snap Analytics", "33 Clarkson House to storage")
-- and every migrated row needs to be identifiable for Xero reconciliation / rollback.

alter table jobs      add column if not exists move_end_date   date;
alter table jobs      add column if not exists legacy_name     text;

-- Migrated-row marker (MIGRATION_MAPPING.md §4/§5 + rollback.ts contract).
alter table customers add column if not exists legacy_imported boolean not null default false;
alter table addresses add column if not exists legacy_imported boolean not null default false;
alter table jobs      add column if not exists legacy_imported boolean not null default false;
alter table invoices  add column if not exists legacy_imported boolean not null default false;
alter table payments  add column if not exists legacy_imported boolean not null default false;

create index if not exists jobs_legacy_imported_idx     on jobs(company_id)     where legacy_imported;
create index if not exists invoices_legacy_imported_idx on invoices(company_id) where legacy_imported;
create index if not exists customers_legacy_imported_idx on customers(company_id) where legacy_imported;
