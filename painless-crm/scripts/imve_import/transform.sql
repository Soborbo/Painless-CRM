-- iMVE legacy import — server-side transform (ADR-040, Phase 17).
-- Runs AFTER the staging tables stg.jobs / stg.invoices / stg.invoice_lines are
-- populated (see generate_staging.py). Builds the normalised CRM rows entirely
-- with set-based SQL: customer dedup, postcode-only addresses, jobs, invoices,
-- lines, and a payment + allocation per "Paid" invoice. Every row is flagged
-- legacy_imported = true so rollback.sql can reverse it cleanly.
--
-- Tenant: the seeded Painless company.
begin;

-- ---- customers: one per dedup key (email > phone > name), earliest-contact values
create table stg.cust_map as
with firsts as (
  select distinct on (cust_key) cust_key, first_name, last_name, email, phone, source, created_date
  from stg.jobs order by cust_key, created_date asc nulls last
)
select cust_key, gen_random_uuid() as customer_id, first_name, last_name, email, phone, source, created_date
from firsts;

insert into customers (id, company_id, customer_type, first_name, last_name, primary_email, primary_phone,
                       acquisition_source, created_at, updated_at, legacy_imported)
select customer_id, '00000000-0000-0000-0000-000000000001', 'individual',
       nullif(first_name,''), nullif(last_name,''), nullif(email,''), nullif(phone,''), nullif(source,''),
       coalesce(created_date::timestamptz, now()), coalesce(created_date::timestamptz, now()), true
from stg.cust_map;

-- ---- addresses: postcode-only, deduped case-insensitively (matches addresses_dedup_idx)
create table stg.addr_map as
select dk, (array_agg(pc order by pc))[1] as pc, gen_random_uuid() as address_id
from (
  select distinct nullif(trim(from_pc),'') as pc from stg.jobs
  union select distinct nullif(trim(to_pc),'') from stg.jobs
) x
cross join lateral (select lower(regexp_replace(x.pc,'\s+','','g')) as dk) d
where x.pc is not null
group by dk;

insert into addresses (id, company_id, line1, city, postcode, country, legacy_imported)
select address_id, '00000000-0000-0000-0000-000000000001', pc, 'Unknown', pc, 'GB', true
from stg.addr_map;

-- ---- jobs (status -> stage in Python; raw status kept in sub_status; decline_reason set)
create table stg.job_map as select job_number, gen_random_uuid() as job_id from stg.jobs;

insert into jobs (id, company_id, job_number, customer_id, stage, sub_status, decline_reason,
                  acquisition_source, legacy_name, enquiry_at, move_date, move_end_date,
                  created_at, updated_at, legacy_imported)
select jm.job_id, '00000000-0000-0000-0000-000000000001', s.job_number, cm.customer_id,
       s.stage::job_stage, nullif(s.status_raw,''), nullif(s.decline_reason,''),
       nullif(s.source,''), nullif(s.legacy_name,''),
       s.created_date::timestamptz, s.move_start::timestamptz, s.move_end,
       coalesce(s.created_date::timestamptz, now()), coalesce(s.created_date::timestamptz, now()), true
from stg.jobs s
join stg.job_map jm using (job_number)
join stg.cust_map cm using (cust_key);

-- ---- job_addresses (from / to) via the normalised postcode map
insert into job_addresses (id, company_id, job_id, address_id, role, sequence)
select gen_random_uuid(), '00000000-0000-0000-0000-000000000001', jm.job_id, am.address_id, 'from', 0
from stg.jobs s
join stg.job_map jm on jm.job_number = s.job_number
join stg.addr_map am on am.dk = lower(regexp_replace(trim(s.from_pc),'\s+','','g'))
where nullif(trim(s.from_pc),'') is not null;

insert into job_addresses (id, company_id, job_id, address_id, role, sequence)
select gen_random_uuid(), '00000000-0000-0000-0000-000000000001', jm.job_id, am.address_id, 'to', 1
from stg.jobs s
join stg.job_map jm on jm.job_number = s.job_number
join stg.addr_map am on am.dk = lower(regexp_replace(trim(s.to_pc),'\s+','','g'))
where nullif(trim(s.to_pc),'') is not null;

-- ---- invoices (join through stg.jobs so invoices for skipped test jobs are dropped)
create table stg.inv_map as select invoice_number, gen_random_uuid() as invoice_id from stg.invoices;

insert into invoices (id, company_id, job_id, customer_id, invoice_number, type, status,
                      subtotal_pence, vat_pence, total_pence, amount_paid_pence,
                      issued_at, due_at, created_at, updated_at, legacy_imported)
select im.invoice_id, '00000000-0000-0000-0000-000000000001', jm.job_id, cm.customer_id,
       i.invoice_number, i.kind,
       case when i.status_raw ilike 'paid' then 'paid' else 'sent' end,
       i.subtotal_p, i.vat_p, i.total_p,
       case when i.status_raw ilike 'paid' then i.total_p else 0 end,
       i.issue_date::timestamptz, i.due_date::timestamptz,
       coalesce(i.created_date::timestamptz, i.issue_date::timestamptz, now()),
       coalesce(i.created_date::timestamptz, i.issue_date::timestamptz, now()), true
from stg.invoices i
join stg.jobs sj on sj.job_number = i.job_ref
join stg.job_map jm on jm.job_number = i.job_ref
join stg.cust_map cm on cm.cust_key = sj.cust_key
join stg.inv_map im on im.invoice_number = i.invoice_number;

insert into invoice_lines (id, company_id, invoice_id, description, quantity, unit_price_pence,
                           vat_rate, line_total_pence, sort_order)
select gen_random_uuid(), '00000000-0000-0000-0000-000000000001', im.invoice_id,
       coalesce(nullif(l.description,''),'Service'), 1, l.unit_p, 20.00, l.unit_p, l.sort
from stg.invoice_lines l
join stg.inv_map im on im.invoice_number = l.invoice_number
join invoices inv on inv.invoice_number = l.invoice_number
  and inv.company_id = '00000000-0000-0000-0000-000000000001';

-- ---- payments + allocations for every "Paid" invoice with a positive total
create table stg.pay_map as
select i.id as invoice_id, i.invoice_number, i.customer_id, i.total_pence,
       coalesce(i.issued_at, i.created_at) as occ, gen_random_uuid() as pay_id
from invoices i
where i.company_id = '00000000-0000-0000-0000-000000000001'
  and i.legacy_imported and i.status = 'paid' and i.total_pence > 0;

insert into payments (id, company_id, customer_id, amount_pence, method, occurred_at, reference,
                      source, created_at, updated_at, legacy_imported)
select pay_id, '00000000-0000-0000-0000-000000000001', customer_id, total_pence, 'bank_transfer',
       occ, invoice_number, 'manual', occ, occ, true
from stg.pay_map;

insert into payment_allocations (id, company_id, payment_id, invoice_id, allocation_type, amount_pence, allocated_at)
select gen_random_uuid(), '00000000-0000-0000-0000-000000000001', pay_id, invoice_id,
       'payment_to_invoice', total_pence, occ
from stg.pay_map;

commit;
