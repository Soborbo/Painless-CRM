-- ============================================================
-- Phase 13b: comms automation extension — job service line + arrival window
-- ============================================================
-- Migrating Jay's iMVE transactional email templates into the Comms Hub
-- (EMAIL_TEMPLATES.md) needs two new job attributes the templates render /
-- filter on. The automation engine itself needs no schema change: trigger_event
-- is free text and trigger_filters / action_config are jsonb, so the new event
-- triggers and dwell-guarded follow-ups (ADR-024) live in those columns.
--
-- ADR-025 — service_type discriminates the removals quote from the waste-
-- clearance quote (both fire on the `quoted` stage); matched via
-- trigger_filters.service_type.
-- ADR-026 — arrival_window is the customer-facing crew arrival slot rendered by
-- the {{move_time}} merge field in the Removal confirmation template.
--
-- Both are columns on the `jobs` spine table — see DECISIONS.md ADR-025/026.
-- ============================================================

alter table jobs
  add column if not exists service_type text not null default 'removal'
    check (service_type in ('removal', 'waste_clearance', 'storage'));

alter table jobs
  add column if not exists arrival_window text;

-- Quote automation filters by (stage, service_type); keep that lookup tight for
-- the engine's rule match without bloating the existing stage index.
create index if not exists jobs_service_type_idx
  on jobs (company_id, service_type)
  where deleted_at is null;
