-- ============================================================
-- Tamar Call Stats (CDR) integration + inbound call log (ADR-041)
-- ============================================================
-- The main Painless number is hosted at Tamar Telecommunications. Tamar
-- exposes a pull-based Call Stats API (CDRs) — there is no inbound webhook —
-- so a cron polls `/cdrs` and ingests each call into the existing `phone_calls`
-- table with source = 'tamar_api'. The table already carries direction,
-- caller/called number, duration, occurred_at and the outcome/follow-up
-- columns; this migration adds only what the integration needs:
--
--  1. external_id    — Tamar's CDR unique id, so re-polling an overlapping
--                      window is idempotent (upsert on the unique index, no
--                      duplicate rows).
--  2. returned_at /  — "user X called this person back". Stamped from the
--     returned_by_id    authenticated user when they action an inbound call in
--                      the call inbox; the accompanying note is written to the
--                      job (notes.parent_type='job') so it lands on the job
--                      sheet + timeline, visible to everyone.
--
-- `phone_calls` is not a spine table, so columns need no ADR; the *integration*
-- is ADR-041. RLS already covers the table (phase 03 Section E, `for all`
-- tenant scope), which permits the authenticated UPDATE the inbox issues. The
-- cron ingests via the service-role client (bypasses RLS) like every other job.
-- ============================================================

alter table phone_calls add column if not exists external_id text;
alter table phone_calls add column if not exists returned_at timestamptz;
alter table phone_calls add column if not exists returned_by_id uuid references users(id);

comment on column phone_calls.external_id is
  'Provider-side unique id of the call record (e.g. Tamar CDR id). NULL for manually logged calls. Makes provider ingestion idempotent via the unique index below.';
comment on column phone_calls.returned_at is
  'When an inbound call was marked called-back from the call inbox.';
comment on column phone_calls.returned_by_id is
  'The user who marked the inbound call called-back (login-attributed).';

-- Idempotent provider ingestion. NULLs are distinct in a Postgres unique index,
-- so the many manually-logged rows (external_id IS NULL) never collide; only two
-- rows that share the same (company, source, external_id) conflict — exactly the
-- re-poll case the cron upserts on.
create unique index if not exists phone_calls_external_uidx
  on phone_calls (company_id, source, external_id);

-- Hot path for the call inbox: this tenant's inbound calls, newest first.
create index if not exists phone_calls_inbound_inbox_idx
  on phone_calls (company_id, occurred_at desc)
  where direction = 'inbound';
