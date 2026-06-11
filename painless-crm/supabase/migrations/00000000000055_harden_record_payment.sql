-- Security hardening — defense-in-depth for record_payment (advisor 0029).
--
-- record_payment is SECURITY DEFINER (bypasses RLS by design) and is exposed as
-- a PostgREST RPC at /rest/v1/rpc/record_payment, callable by any `authenticated`
-- session. The recordPayment server action gates it with requireRole(billing)
-- and passes a server-derived p_company_id — but a stolen/low-privilege session
-- could call the RPC directly with a forged p_company_id, recording a payment in
-- another tenant or bypassing the billing-role check entirely.
--
-- This migration re-asserts both guarantees INSIDE the function, so the database
-- is self-defending regardless of caller. The body is otherwise byte-for-byte
-- identical to migration 00000000000051. service_role (auth.uid() is null, e.g.
-- background jobs) is trusted and skips the gate.
--
-- The sibling SECURITY DEFINER functions flagged by the advisor
-- (customer_lifetime_value, find_duplicate_candidates) already filter on
-- current_user_company_id() internally, and the current_user_* helpers only
-- return the caller's own row — so they need no change.

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
  -- Defense-in-depth: a direct RPC caller must not forge a cross-tenant payment
  -- nor bypass the billing-role check the server action enforces. Skipped for
  -- service_role (auth.uid() is null), which is trusted.
  if auth.uid() is not null then
    if p_company_id is distinct from public.current_user_company_id() then
      raise exception 'tenant_mismatch' using errcode = '42501';
    end if;
    if not public.current_user_has_role(array['accounts', 'manager', 'admin', 'super_admin']) then
      raise exception 'forbidden' using errcode = '42501';
    end if;
  end if;

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
