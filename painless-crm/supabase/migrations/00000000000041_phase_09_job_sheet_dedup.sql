-- ============================================================
-- Phase 09: offline-queue dedup provenance on job_sheets
-- ============================================================
-- The end-of-job sheet is submitted from the worker PWA and replayed through the
-- offline queue, so it needs the same client_event_id idempotency basis as the
-- other ops tables (migration 40). Nullable + partial unique index so office
-- edits are unaffected.
-- ============================================================

alter table job_sheets add column if not exists client_event_id uuid;
alter table job_sheets add column if not exists client_recorded_at timestamptz;

create unique index if not exists job_sheets_client_event_idx
  on job_sheets (worker_id, client_event_id)
  where client_event_id is not null;
