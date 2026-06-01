-- ============================================================
-- Phase 11: Customer sign-off, review request + complaint plumbing
-- ============================================================
-- The end-of-job sign-off is captured on the worker PWA (customer signature on
-- the worker's phone) and replayed through the offline queue, so it needs the
-- same client_event_id idempotency basis as the other ops tables (migrations
-- 40/41). One signoff per job (partial unique on job_id) makes the
-- in_progress -> completed transition idempotent on replay.
--
-- It also wires the two FKs/columns the spine needs for Phase 11 that Phase 02
-- did not add: jobs.customer_signoff_id (STATE_MACHINE.md completed entry
-- condition) and companies.gmb_place_id (the Google review link target,
-- Phase 11 §3). And a one-review-request-per-signoff guard so the `paid`
-- automation can enqueue idempotently.
-- ============================================================

-- --- Offline-queue provenance on customer_signoffs (mirrors job_sheets) ---
alter table customer_signoffs add column if not exists client_event_id uuid;
alter table customer_signoffs add column if not exists client_recorded_at timestamptz;

create unique index if not exists customer_signoffs_client_event_idx
  on customer_signoffs (collected_by_worker_id, client_event_id)
  where client_event_id is not null;

-- One live sign-off per job — the completed-stage transition is idempotent.
create unique index if not exists customer_signoffs_one_per_job_idx
  on customer_signoffs (job_id)
  where deleted_at is null;

-- --- Spine columns Phase 02 left for this phase ---
alter table jobs add column if not exists customer_signoff_id uuid references customer_signoffs(id);

alter table companies add column if not exists gmb_place_id text;

-- --- One review request per sign-off (idempotent `paid` enqueue) ---
create unique index if not exists review_requests_one_per_signoff_idx
  on review_requests (signoff_id)
  where deleted_at is null;

-- Cron lookup: pending requests waiting to send / follow up.
create index if not exists review_requests_pending_idx
  on review_requests (company_id, status, sent_at)
  where deleted_at is null;

-- Complaints SLA / escalation sweep lookup.
create index if not exists complaints_open_idx
  on complaints (company_id, status, created_at)
  where deleted_at is null and status in ('new', 'investigating');
