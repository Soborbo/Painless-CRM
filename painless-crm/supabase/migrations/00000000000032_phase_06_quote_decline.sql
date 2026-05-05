-- ============================================================
-- Phase 06: Customer-facing quote decline
-- ============================================================
-- The acceptance page exposes a "not for me" affordance that
-- flips the quote to `declined` and stores an optional free-text
-- reason. This gives sales a funnel signal without requiring a
-- callback. Reasons are short on purpose — anything longer
-- belongs in a phone call, not a public textarea.
-- ============================================================

alter table quotes
  add column if not exists declined_at timestamptz,
  add column if not exists decline_reason text;

alter table quotes
  add constraint quotes_decline_reason_length_chk
  check (decline_reason is null or char_length(decline_reason) <= 500);

comment on column quotes.declined_at is
  'When the customer declined via the public share link. Null for accepted/expired/draft quotes.';
comment on column quotes.decline_reason is
  'Optional free-text reason captured from the decline form. Capped at 500 chars by check constraint.';
