-- ============================================================
-- Phase 06: Quote open tracking
-- ============================================================
-- The public acceptance page records when the customer first
-- and most recently opened the share link, plus a coarse open
-- count. Used by the dashboard to surface engagement signals
-- alongside send/accept events. Bots that hit the link will be
-- counted too — the column is a hint, not an audit record.
-- ============================================================

alter table quotes
  add column if not exists first_opened_at timestamptz,
  add column if not exists last_opened_at timestamptz,
  add column if not exists open_count int not null default 0;

comment on column quotes.first_opened_at is
  'Timestamp of the first GET on the public share link. Null until the customer opens the quote.';
comment on column quotes.last_opened_at is
  'Timestamp of the most recent GET on the public share link. Updated on every open after the throttle window.';
comment on column quotes.open_count is
  'Best-effort counter of public-link opens. Not deduped by IP; treat as a coarse engagement hint.';
