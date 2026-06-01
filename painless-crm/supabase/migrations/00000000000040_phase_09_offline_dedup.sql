-- ============================================================
-- Phase 09: offline-queue dedup provenance on the ops tables
-- ============================================================
-- The worker PWA records actions offline and replays them when it next syncs.
-- Each action carries a client-generated UUID (client_event_id) so the server
-- can upsert idempotently — replaying the same action is a no-op. The Phase 02
-- tables (time_entries, vehicle_checks, photos) predate this, so add the
-- provenance columns + the dedup unique indexes here. Columns are nullable so
-- legacy/office-created rows are unaffected; the unique index is partial.
-- ============================================================

alter table time_entries add column if not exists client_event_id uuid;
alter table time_entries add column if not exists client_recorded_at timestamptz;
alter table time_entries add column if not exists synced_at timestamptz default now();

create unique index if not exists time_entries_client_event_idx
  on time_entries (worker_id, client_event_id)
  where client_event_id is not null;

-- Stale clock-in detection scans active clock-ins (Phase 09 hourly cron).
create index if not exists time_entries_active_clock_in_idx
  on time_entries (worker_id, occurred_at)
  where type = 'clock_in' and deleted_at is null;

alter table vehicle_checks add column if not exists client_event_id uuid;
alter table vehicle_checks add column if not exists client_recorded_at timestamptz;

create unique index if not exists vehicle_checks_client_event_idx
  on vehicle_checks (worker_id, client_event_id)
  where client_event_id is not null;

alter table photos add column if not exists client_event_id uuid;
alter table photos add column if not exists client_recorded_at timestamptz;

create unique index if not exists photos_client_event_idx
  on photos (uploaded_by_worker_id, client_event_id)
  where client_event_id is not null;
