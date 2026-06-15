-- Configurable email notification subscriptions (ADR-040).
--
-- Extends the Phase-15 in-app notification system into a per-user,
-- per-event-type email subscription model. Three additive changes, no drops:
--
--  1. notification_preferences.event_prefs — jsonb map { [eventKey]: frequency }
--     where frequency ∈ off|immediate|hourly|daily|weekly. Unset events use the
--     catalog default (src/lib/notifications/events.ts). The existing
--     email_digest_enabled column is retained as a per-user master kill-switch.
--
--  2. notifications.email_sent_at — the single idempotency guard for email
--     delivery. NULL = not yet emailed (or considered for email). Every delivery
--     sweep claims `where email_sent_at is null` and stamps it, so no
--     notification is ever emailed twice regardless of overlapping crons. The
--     partial index keeps the frequent "immediate" sweep cheap.
--
--  3. settings.notification_settings — company-level jsonb config. Currently
--     holds high_value_lead_threshold_pence (default 80000 = £800) for the
--     lead.high_value_uncontacted daily scan.
--
-- All columns are additive with safe defaults, so existing rows and code keep
-- working unchanged.

alter table notification_preferences
  add column if not exists event_prefs jsonb not null default '{}'::jsonb;

alter table notifications
  add column if not exists email_sent_at timestamptz;

create index if not exists notifications_pending_email_idx
  on notifications (created_at)
  where email_sent_at is null;

alter table settings
  add column if not exists notification_settings jsonb not null default '{}'::jsonb;
