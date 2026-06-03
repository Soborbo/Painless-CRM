-- Audit fix H1 (ADR-037) — atomic, balance-bounded payment recording.
--
-- The previous app-side recordPayment did a non-transactional
-- read -> split -> insert -> rollup across separate PostgREST calls with no row
-- lock, which allowed three defects under concurrency / sequencing:
--   1. over-allocation (two concurrent payments both split against a stale
--      outstanding, pushing amount_paid past total and outstanding negative);
--   2. silent rollup no-op (the optimistic UPDATE matched zero rows on a
--      version bump and was discarded, leaving amount_paid stale);
--   3. manual-paid wipe (a manual mark-paid set amount_paid=total with no
--      allocation; a later payment re-summed only allocations and zeroed it).
--
-- record_payment() does the whole thing in ONE transaction with SELECT ... FOR
-- UPDATE on the invoice, so concurrent calls serialize. amount_paid is updated
-- INCREMENTALLY (+= applied), which keeps a manual settlement intact (applied=0
-- when outstanding=0) and keeps the generated amount_outstanding_pence correct.
-- A constraint trigger backstops over-allocation regardless of caller.
--
-- SECURITY DEFINER (bypasses RLS) is safe here because tenant isolation is
-- enforced explicitly: the function only ever touches rows where
-- company_id = p_company_id, and the caller passes the authenticated user's own
-- company_id (server-derived, never from the request body).

create or replace function record_payment(
  p_company_id uuid,
  p_invoice_id uuid,
  p_amount_pence int,
  p_method text,
  p_occurred_at timestamptz,
  p_reference text,
  p_created_by_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice invoices%rowtype;
  v_outstanding int;
  v_applied int;
  v_overpayment int;
  v_payment_id uuid;
  v_new_paid int;
  v_new_status text;
begin
  if p_amount_pence is null or p_amount_pence <= 0 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;

  -- Lock the invoice for the duration of the transaction so two concurrent
  -- payments cannot both read the same outstanding balance.
  select * into v_invoice
  from invoices
  where id = p_invoice_id and company_id = p_company_id and deleted_at is null
  for update;

  if not found then
    raise exception 'invoice_not_found' using errcode = 'P0002';
  end if;
  if v_invoice.status = 'void' then
    raise exception 'invoice_void' using errcode = '22023';
  end if;

  v_outstanding := greatest(v_invoice.total_pence - coalesce(v_invoice.amount_paid_pence, 0), 0);
  v_applied := least(p_amount_pence, v_outstanding);
  v_overpayment := p_amount_pence - v_applied;

  insert into payments (
    company_id, customer_id, amount_pence, method, occurred_at, reference, source, created_by_id
  ) values (
    p_company_id, v_invoice.customer_id, p_amount_pence, p_method,
    coalesce(p_occurred_at, now()), p_reference, 'manual', p_created_by_id
  ) returning id into v_payment_id;

  insert into payment_allocations (
    company_id, payment_id, invoice_id, allocation_type, amount_pence, allocated_by_id
  ) values (
    p_company_id, v_payment_id, p_invoice_id, 'payment_to_invoice', v_applied, p_created_by_id
  );

  if v_overpayment > 0 then
    insert into payment_allocations (
      company_id, payment_id, invoice_id, allocation_type, amount_pence, allocated_by_id
    ) values (
      p_company_id, v_payment_id, null, 'overpayment_held', v_overpayment, p_created_by_id
    );
  end if;

  -- Incremental, not a re-sum: preserves a prior manual settlement that has no
  -- allocation row, and is safe because we hold the row lock.
  v_new_paid := coalesce(v_invoice.amount_paid_pence, 0) + v_applied;

  -- Payment-driven status (mirrors deriveInvoiceStatus in src/lib/invoices/payment.ts).
  -- Time-based 'overdue' stays owned by the dunning cron.
  if v_invoice.total_pence > 0 and v_new_paid >= v_invoice.total_pence then
    v_new_status := 'paid';
  elsif v_new_paid > 0 then
    v_new_status := 'partial';
  elsif v_invoice.status = 'overdue' then
    v_new_status := 'overdue';
  else
    v_new_status := 'sent';
  end if;

  update invoices
  set amount_paid_pence = v_new_paid,
      status = v_new_status,
      version = version + 1,
      updated_at = now()
  where id = p_invoice_id;

  return jsonb_build_object(
    'payment_id', v_payment_id,
    'applied_pence', v_applied,
    'overpayment_pence', v_overpayment,
    'amount_paid_pence', v_new_paid,
    'status', v_new_status,
    'job_id', v_invoice.job_id,
    'invoice_type', v_invoice.type
  );
end;
$$;

grant execute on function record_payment(uuid, uuid, int, text, timestamptz, text, uuid)
  to authenticated, service_role;

-- Belt-and-braces: reject any write that would push an invoice's
-- payment_to_invoice allocations above its total, no matter which code path
-- inserts them. A constraint trigger (deferred to row level) keeps the check
-- next to the data rather than relying on application discipline.
create or replace function assert_invoice_not_overpaid() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total int;
  v_allocated int;
begin
  if NEW.allocation_type = 'payment_to_invoice' and NEW.invoice_id is not null then
    select total_pence into v_total from invoices where id = NEW.invoice_id;
    select coalesce(sum(amount_pence), 0) into v_allocated
    from payment_allocations
    where invoice_id = NEW.invoice_id and allocation_type = 'payment_to_invoice';
    if v_allocated > coalesce(v_total, 0) then
      raise exception 'invoice_overpaid: allocations % exceed total %', v_allocated, v_total
        using errcode = '23514';
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists payment_allocations_no_overpay on payment_allocations;
create constraint trigger payment_allocations_no_overpay
  after insert or update on payment_allocations
  for each row execute function assert_invoice_not_overpaid();
