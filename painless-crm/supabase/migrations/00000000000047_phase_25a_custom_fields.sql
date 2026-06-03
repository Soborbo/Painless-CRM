-- ============================================================
-- Phase 25a: Custom job fields (config-as-data) — ADR-034
-- ============================================================
-- The iMVE "Job Fields Customisation" lets each tenant add extra fields to a
-- job. We model this as config-as-data, not per-tenant code:
--   settings.custom_field_defs — the field definitions (jsonb array), validated
--                                by zod at read (lib/custom-fields/defs.ts).
--   jobs.custom_fields        — the per-job {key: value} map (jsonb).
-- Both default to an empty container so existing rows and the fixed UI keep
-- working unchanged. No RLS change — both tables already carry tenant policies.
-- ============================================================

alter table settings
  add column if not exists custom_field_defs jsonb not null default '[]';

alter table jobs
  add column if not exists custom_fields jsonb not null default '{}';
