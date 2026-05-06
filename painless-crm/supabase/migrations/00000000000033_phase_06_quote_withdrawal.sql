-- ============================================================
-- Phase 06: Sales-side quote withdrawal
-- ============================================================
-- A rep needs to retract a sent quote when they realise they
-- sent the wrong price or terms. We don't introduce a new
-- status value (the check constraint is intentionally narrow);
-- instead a withdrawn quote is `expired` with `withdrawn_at`
-- and `withdrawal_reason` populated. The audit fields capture
-- *who* and *why* so the cause is recoverable later.
-- ============================================================

alter table quotes
  add column if not exists withdrawn_at timestamptz,
  add column if not exists withdrawn_by_user_id uuid references users(id),
  add column if not exists withdrawal_reason text;

alter table quotes
  add constraint quotes_withdrawal_reason_length_chk
  check (withdrawal_reason is null or char_length(withdrawal_reason) <= 500);

comment on column quotes.withdrawn_at is
  'When the rep retracted a sent quote. Differentiates manual withdrawal from time-based or revision-driven expiry.';
comment on column quotes.withdrawn_by_user_id is
  'Rep who issued the withdrawal. Null when expired by other means.';
comment on column quotes.withdrawal_reason is
  'Optional free-text explanation captured at withdrawal time. Capped at 500 chars.';
