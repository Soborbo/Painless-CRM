# Phase 12 — Invoicing & Payments

**Status**: Skeleton
**Duration estimate**: 4 weeks
**Prerequisite**: Phase 06 (quote acceptance), Phase 11 (job complete)

---

## Goal

Three invoice types: deposit (on quote acceptance), custom (mid-job extras), final (on job complete). Full Xero sync (idempotent). GoCardless Direct Debit for recurring storage billing. Email open tracking via Resend webhook. Dunning logic for late payers.

## Deliverables

1. Invoice CRUD: deposit, custom, final, recurring
2. Auto-create deposit on quote acceptance (configurable: skip if customer is `b2b` or value < £X)
3. Auto-create final on job completion (uses sign-off + actual hours)
4. Xero OAuth + sync: invoices push to Xero, payment status pulls back
5. Idempotent: deterministic external IDs, retries safe
6. Resend integration with open tracking webhook
7. GoCardless DD setup for storage customers (mandate flow)
8. Recurring invoices for storage (monthly, auto-collected)
9. Dunning: 3, 7, 14 days overdue → escalating email; 30 days → admin alert
10. Payment allocation: payments → invoices (handle partial, overpayment)

## Key decisions

- **DECISION**: Stripe vs GoCardless for recurring — GoCardless wins for UK SME storage (Direct Debit is the standard, cheaper than card fees, fewer chargebacks)
- **DECISION**: Xero is mandatory for accounts (Jay's accountant uses it); no in-house bookkeeping
- **DECISION**: Invoice numbering — sequential per company (e.g., `PR-2026-0142`), configurable prefix in settings

## Schema additions

```sql
create table invoices (
  id uuid primary key,
  company_id uuid not null,
  job_id uuid references jobs(id),  -- null for recurring storage
  customer_id uuid not null references customers(id),
  storage_rental_id uuid references storage_rentals(id),
  invoice_number text not null,
  type text check (type in ('deposit', 'custom', 'final', 'storage_recurring', 'storage_initial', 'credit_note')),
  status text check (status in ('draft', 'sent', 'paid', 'partial', 'overdue', 'void')),
  subtotal_pence int not null,
  vat_pence int not null default 0,
  total_pence int not null,
  amount_paid_pence int default 0,
  amount_outstanding_pence int generated always as (total_pence - coalesce(amount_paid_pence, 0)) stored,
  issued_at timestamptz,
  due_at timestamptz,
  -- Xero sync
  xero_id text unique,
  xero_synced_at timestamptz,
  xero_sync_error text,
  -- Email tracking
  email_sent_at timestamptz,
  email_opened_at timestamptz,
  email_message_id text,  -- Resend message ID
  -- Audit
  created_by_id uuid references users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  version int default 1,
  deleted_at timestamptz,
  unique (company_id, invoice_number)
);

create table invoice_lines (
  id uuid primary key,
  company_id uuid not null,                                      -- v2: denormalized for tenant isolation + RLS perf
  invoice_id uuid not null references invoices(id) on delete cascade,
  description text not null,
  quantity numeric not null default 1,
  unit_price_pence int not null,
  vat_rate numeric(5,2) default 20.00,
  line_total_pence int not null,
  sort_order int default 0
);
-- Trigger auto-sets company_id from parent invoice (see references/schema.sql)

create table payments (
  id uuid primary key,
  company_id uuid not null,
  customer_id uuid not null references customers(id),
  amount_pence int not null check (amount_pence > 0),
  method text check (method in ('bank_transfer', 'card', 'direct_debit', 'cash', 'cheque', 'other')),
  occurred_at timestamptz not null,
  reference text,
  -- v2: invoice_id and JSONB allocations REMOVED. See payment_allocations table below
  -- and ADR-008. A payment doesn't directly know its invoice — it knows its allocations.
  xero_id text unique,
  source text check (source in ('xero_sync', 'gocardless_webhook', 'manual')),
  notes text,
  created_at timestamptz default now(),
  deleted_at timestamptz,
  version int not null default 1
);

-- v2: dedicated table for accounting-grade allocation tracking
create table payment_allocations (
  id uuid primary key,
  company_id uuid not null,
  payment_id uuid not null references payments(id) on delete restrict,
  invoice_id uuid references invoices(id) on delete restrict,
  allocation_type text not null check (allocation_type in (
    'payment_to_invoice',  -- normal: this payment pays this invoice partially or fully
    'refund',              -- negative: money returned to customer (negative amount_pence)
    'write_off',           -- negative: invoice written off as bad debt
    'credit_note_applied', -- a Xero credit note applied to a customer balance
    'overpayment_held'     -- excess held as customer credit until next invoice
  )),
  amount_pence int not null,
  allocated_at timestamptz not null default now(),
  allocated_by_id uuid references users(id),
  notes text,
  reverses_allocation_id uuid references payment_allocations(id),
  created_at timestamptz default now()
);

-- v2: view exposing unallocated balance per payment
-- create or replace view payments_with_balance as
-- select p.*, p.amount_pence - coalesce(sum(pa.amount_pence), 0) as unallocated_pence
-- from payments p left join payment_allocations pa on pa.payment_id = p.id
-- where p.deleted_at is null group by p.id

create table direct_debit_mandates (
  id uuid primary key,
  company_id uuid not null,
  customer_id uuid not null references customers(id),
  storage_rental_id uuid references storage_rentals(id),
  gocardless_mandate_id text unique not null,
  status text check (status in ('pending', 'active', 'cancelled', 'failed', 'expired')),
  bank_name text,
  account_holder_name text,
  account_last4 text,
  set_up_at timestamptz,
  cancelled_at timestamptz,
  cancelled_reason text
);
```

## Xero integration

```ts
// src/lib/integrations/xero/client.ts
//
// OAuth2 flow. Tokens stored in integration_credentials table (provider='xero')
// with pgcrypto encryption. See ADR-009 and INTEGRATION_CONTRACTS.md §3.
// Token lifecycle: access 30 min, refresh 60 days (rotates per refresh).
// Refresh strategy: cron every 25 min refreshes any tokens expiring in next 5 min.
// On 3 consecutive refresh failures: mark status='expired', notify admin.
//
// Service-side helper:
//   const xero = await getXeroClient(companyId);  // returns refreshed client
//   await xero.invoices.create({ ... });
//
// Calls go through credential access logger -> integration_credential_access_log
```

Idempotency: every Xero call uses an `Idempotency-Key` header derived from CRM entity (e.g., `crm-invoice-{invoice_id}`). Re-running the same call is safe.

Webhooks (Xero → CRM): use the v2 webhook handler with `WEBHOOK_SECRET_XERO` (Xero-issued). See `references/webhook-pattern.md`.

## GoCardless integration

```ts
// src/lib/integrations/gocardless/
// Mandate setup: redirect customer to GC Pay for bank details
// Webhook handler for: mandate created, mandate cancelled, payment succeeded, payment failed
// Recurring billing: GC creates payments based on schedules (one schedule per active rental)
```

## Recurring storage billing

- Customer signs up: storage_rental created with monthly_rate_pence
- DD mandate set up: `direct_debit_mandates` row created
- GC schedule created: monthly, starts on rental start date
- Each successful collection: webhook → create `payments` row → mark monthly invoice paid
- Failed collection: webhook → mark invoice `overdue`, dunning starts

## Dunning sequence

- T+3 days overdue: email "Just a friendly reminder…"
- T+7 days: email "Second reminder, please reply"
- T+14 days: email + SMS "Urgent: please respond"
- T+30 days: admin notification + auto-pause storage access (configurable)

## Acceptance criteria

- [ ] Quote acceptance auto-creates deposit invoice (if configured)
- [ ] Job completion auto-creates final invoice
- [ ] Invoice email opens tracked, visible on invoice
- [ ] Xero sync creates invoice in Xero, syncs payment back
- [ ] Resyncing same invoice doesn't duplicate
- [ ] DD mandate flow: customer enters bank details, mandate active
- [ ] Monthly storage rental triggers DD collection on schedule
- [ ] Failed payment marks invoice overdue, dunning sequence kicks in
- [ ] Admin can override dunning per customer (e.g., long-time customer in temporary trouble)

## Out of scope

- Payment plans / installments (post-v1)
- Multi-currency (GBP only)
- Automated 1099/tax filings (Xero handles this)
- In-app payment surface (always Xero or GC link)
