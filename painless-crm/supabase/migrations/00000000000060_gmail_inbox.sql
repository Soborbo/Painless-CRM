-- ============================================================
-- Gmail inbound-mail ingestion (ADR-044)
-- ============================================================
-- The shared Painless mailbox (e.g. info@painlessremovals.com) is on Google
-- Workspace. A service account with domain-wide delegation impersonates it and
-- a cron polls the Gmail API read-only (mirrors the Tamar CDR poller, ADR-041) —
-- there is no push subscription wired in this round. Each inbound message is
-- ingested into `email_messages`, matched to a customer by from-address (or a
-- contact is created), summarised onto the customer timeline (notes), and an
-- `email.received` notification is fired.
--
-- Two tables:
--   1. email_sync_state — the per-(company, mailbox) Gmail history cursor, so a
--      run does an incremental users.history delta instead of re-listing.
--   2. email_messages   — the ingested mail log. Unique on (company_id,
--      gmail_msg_id) so re-polling an overlapping window is idempotent (upsert
--      ON CONFLICT DO NOTHING + a "seen" set guarding the note/notification).
--
-- Neither is a spine table, so columns need no ADR; the *integration* is
-- ADR-044. Both carry company_id NOT NULL + RLS (multi-tenant rule). The cron
-- ingests via the service-role client (bypasses RLS) like every other job; the
-- policy is for the authenticated UI reads that surface this mail later.
-- ============================================================

create table if not exists email_sync_state (
  company_id uuid not null references companies(id),
  mailbox text not null,
  history_id text,
  last_synced_at timestamptz,
  primary key (company_id, mailbox)
);

create table if not exists email_messages (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id),
  customer_id uuid references customers(id),
  direction text not null default 'inbound'
    check (direction in ('inbound', 'outbound')),
  gmail_msg_id text not null,
  thread_id text,
  message_id_hdr text,
  in_reply_to text,
  from_email text,
  from_name text,
  to_email text,
  subject text,
  snippet text,
  body_text text,
  internal_date timestamptz,
  source text not null default 'gmail',
  created_at timestamptz not null default now()
);

-- Idempotent provider ingestion: one row per Gmail message id per tenant.
create unique index if not exists email_messages_msg_uidx
  on email_messages (company_id, gmail_msg_id);

-- Hot path for the (future) inbox view: this tenant's inbound mail, newest first.
create index if not exists email_messages_inbound_idx
  on email_messages (company_id, internal_date desc)
  where direction = 'inbound';

-- Per-customer history (timeline / customer panel).
create index if not exists email_messages_customer_idx
  on email_messages (customer_id);

alter table email_messages enable row level security;
drop policy if exists email_messages_tenant on email_messages;
create policy email_messages_tenant on email_messages
  for all to authenticated
  using (company_id = public.current_user_company_id())
  with check (company_id = public.current_user_company_id());

alter table email_sync_state enable row level security;
drop policy if exists email_sync_state_tenant on email_sync_state;
create policy email_sync_state_tenant on email_sync_state
  for all to authenticated
  using (company_id = public.current_user_company_id())
  with check (company_id = public.current_user_company_id());
