-- Customer merge / duplicate resolution (feature survey — Customer 360 §Merge).
--
-- merge_customers atomically folds a duplicate ("loser") customer into the one
-- the office wants to keep ("winner"): every child row is re-pointed from loser
-- to winner, the winner inherits any contact details it was missing, and the
-- loser is soft-deleted. Doing this in a single SECURITY DEFINER function gives
-- the operation a transaction — a half-merged customer (jobs moved, invoices
-- not) would be worse than no merge at all.
--
-- Security mirrors record_payment (migration 55): the body re-asserts tenant
-- isolation and the role gate so a direct PostgREST caller can't forge a
-- cross-tenant merge or skip the server action's requireRole. service_role
-- (auth.uid() is null) is trusted and skips the gate.
--
-- Safe to re-point blind because no child table has a UNIQUE constraint on
-- customer_id (verified against the schema), so moving rows can't collide. The
-- audit-log trigger fires automatically on each UPDATE (CLAUDE rule 10).
--
-- NOTE: destructive and not runnable in CI here — apply and test on a Supabase
-- branch (seed a winner + loser with jobs/invoices, merge, assert child rows
-- moved and the loser is soft-deleted) before promoting to production.

create or replace function merge_customers(
  p_company_id uuid,
  p_winner_id uuid,
  p_loser_id uuid,
  p_loser_version int
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_winner customers%rowtype;
  v_loser customers%rowtype;
begin
  -- Defense-in-depth: forbid cross-tenant and enforce the same role gate the
  -- mergeCustomers server action applies. Skipped for service_role.
  if auth.uid() is not null then
    if p_company_id is distinct from public.current_user_company_id() then
      raise exception 'tenant_mismatch' using errcode = '42501';
    end if;
    if not public.current_user_has_role(array['manager', 'admin', 'super_admin']) then
      raise exception 'forbidden' using errcode = '42501';
    end if;
  end if;

  if p_winner_id = p_loser_id then
    raise exception 'same_customer' using errcode = '22023';
  end if;

  -- Lock both rows. Lock the lower id first so concurrent reciprocal merges
  -- can't deadlock.
  if p_winner_id < p_loser_id then
    select * into v_winner from customers
      where id = p_winner_id and company_id = p_company_id and deleted_at is null for update;
    select * into v_loser from customers
      where id = p_loser_id and company_id = p_company_id and deleted_at is null for update;
  else
    select * into v_loser from customers
      where id = p_loser_id and company_id = p_company_id and deleted_at is null for update;
    select * into v_winner from customers
      where id = p_winner_id and company_id = p_company_id and deleted_at is null for update;
  end if;

  if v_winner.id is null then
    raise exception 'winner_not_found' using errcode = 'P0002';
  end if;
  if v_loser.id is null then
    raise exception 'loser_not_found' using errcode = 'P0002';
  end if;

  -- Optimistic concurrency on the record being retired (CLAUDE rule 12).
  if v_loser.version is distinct from p_loser_version then
    raise exception 'version_conflict' using errcode = '40001';
  end if;

  -- Re-point every child row, tenant-scoped. No deleted_at filter: soft-deleted
  -- history follows the surviving record too.
  update customer_contacts set customer_id = p_winner_id
    where customer_id = p_loser_id and company_id = p_company_id;
  update customer_consents set customer_id = p_winner_id
    where customer_id = p_loser_id and company_id = p_company_id;
  update jobs set customer_id = p_winner_id
    where customer_id = p_loser_id and company_id = p_company_id;
  update quote_acceptances set customer_id = p_winner_id
    where customer_id = p_loser_id and company_id = p_company_id;
  update storage_rentals set customer_id = p_winner_id
    where customer_id = p_loser_id and company_id = p_company_id;
  update customer_signoffs set customer_id = p_winner_id
    where customer_id = p_loser_id and company_id = p_company_id;
  update review_requests set customer_id = p_winner_id
    where customer_id = p_loser_id and company_id = p_company_id;
  update complaints set customer_id = p_winner_id
    where customer_id = p_loser_id and company_id = p_company_id;
  update invoices set customer_id = p_winner_id
    where customer_id = p_loser_id and company_id = p_company_id;
  update payments set customer_id = p_winner_id
    where customer_id = p_loser_id and company_id = p_company_id;
  update direct_debit_mandates set customer_id = p_winner_id
    where customer_id = p_loser_id and company_id = p_company_id;
  update messages set customer_id = p_winner_id
    where customer_id = p_loser_id and company_id = p_company_id;
  update phone_calls set customer_id = p_winner_id
    where customer_id = p_loser_id and company_id = p_company_id;
  update attributions set customer_id = p_winner_id
    where customer_id = p_loser_id and company_id = p_company_id;
  update documents set parent_customer_id = p_winner_id
    where parent_customer_id = p_loser_id and company_id = p_company_id;
  update email_messages set customer_id = p_winner_id
    where customer_id = p_loser_id and company_id = p_company_id;
  update tasks set customer_id = p_winner_id
    where customer_id = p_loser_id and company_id = p_company_id;
  update appointments set customer_id = p_winner_id
    where customer_id = p_loser_id and company_id = p_company_id;

  -- Relationships: move both ends onto the winner, then soft-delete any that
  -- collapsed into a self-reference (loser was related to winner).
  update customer_relationships set from_customer_id = p_winner_id
    where from_customer_id = p_loser_id and company_id = p_company_id;
  update customer_relationships set to_customer_id = p_winner_id
    where to_customer_id = p_loser_id and company_id = p_company_id;
  update customer_relationships set deleted_at = now(), version = version + 1, updated_at = now()
    where from_customer_id = to_customer_id and company_id = p_company_id and deleted_at is null;

  -- Winner inherits any contact detail it was missing.
  update customers set
    first_name = coalesce(v_winner.first_name, v_loser.first_name),
    last_name = coalesce(v_winner.last_name, v_loser.last_name),
    company_name = coalesce(v_winner.company_name, v_loser.company_name),
    vat_number = coalesce(v_winner.vat_number, v_loser.vat_number),
    primary_email = coalesce(v_winner.primary_email, v_loser.primary_email),
    primary_phone = coalesce(v_winner.primary_phone, v_loser.primary_phone),
    primary_address_id = coalesce(v_winner.primary_address_id, v_loser.primary_address_id),
    acquisition_source = coalesce(v_winner.acquisition_source, v_loser.acquisition_source),
    notes = case
      when coalesce(v_winner.notes, '') = '' then v_loser.notes
      else v_winner.notes
    end,
    version = version + 1,
    updated_at = now()
  where id = p_winner_id;

  -- Retire the loser (soft delete only — CLAUDE rule 11).
  update customers set deleted_at = now(), version = version + 1, updated_at = now()
    where id = p_loser_id and version = p_loser_version;

  return jsonb_build_object('winner_id', p_winner_id, 'loser_id', p_loser_id);
end;
$$;

comment on function merge_customers is
  'Folds a duplicate customer (loser) into the keeper (winner): re-points all child rows, inherits missing contact fields, soft-deletes the loser. SECURITY DEFINER with internal tenant + role (manager+) checks. See feature survey Customer 360 §Merge.';

-- Lock down the RPC the same way as the other SECURITY DEFINER functions.
alter function public.merge_customers(uuid, uuid, uuid, int) set search_path = public, pg_catalog;
revoke all on function public.merge_customers(uuid, uuid, uuid, int) from public;
revoke all on function public.merge_customers(uuid, uuid, uuid, int) from anon;
grant execute on function public.merge_customers(uuid, uuid, uuid, int) to authenticated, service_role;
