-- ============================================================
-- Phase 25 (Job Sheet customisation) + Phase 09 (vehicle-check admin realtime)
-- ADR-034 (config-as-data) + ADR-036
-- ============================================================
-- Job Sheet customisation reuses the generic custom-field engine (ADR-034):
--   settings.job_sheet_fields — the def list (same shape as custom_field_defs)
--   job_sheets.custom_fields   — per-sheet {key: value} map
-- No new tables, no per-tenant code; validated by zod at read/write.
--
-- Phase 09: enable Supabase Realtime on vehicle_checks so the dashboard admin
-- view can live-refresh as workers submit pre-checks. Adding to the publication
-- is a no-op when the table is already present.
-- ============================================================

alter table settings add column if not exists job_sheet_fields jsonb not null default '[]';
alter table job_sheets add column if not exists custom_fields jsonb not null default '{}';

-- Realtime publication for the vehicle-check admin view (idempotent).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'vehicle_checks'
  ) then
    alter publication supabase_realtime add table vehicle_checks;
  end if;
exception
  when undefined_object then
    -- publication not present in this environment (e.g. bare test db); skip.
    null;
end $$;
