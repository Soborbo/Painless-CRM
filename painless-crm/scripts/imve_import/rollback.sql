-- Rollback the iMVE legacy import (ADR-040 / MIGRATION_MAPPING.md).
-- Removes ONLY rows flagged `legacy_imported = true`. Anything created in the
-- app after the import (without the flag) is untouched. Child rows first.
begin;

delete from payment_allocations pa using payments p
  where pa.payment_id = p.id and p.legacy_imported;
delete from payments where legacy_imported;

delete from invoice_lines il using invoices i
  where il.invoice_id = i.id and i.legacy_imported;
delete from invoices where legacy_imported;

delete from job_addresses ja using jobs j
  where ja.job_id = j.id and j.legacy_imported;
delete from jobs where legacy_imported;

delete from addresses where legacy_imported;
delete from customers where legacy_imported;

commit;
