-- ============================================================
-- Phase 25b/25c + 26: customisation + integration config (config-as-data)
-- ADR-034 (config-as-data) + ADR-035 (Phase 26)
-- ============================================================
-- More tenant config carried as jsonb on the settings row, validated by zod at
-- read (no per-tenant code, no new tables):
--   document_text       — 25b: acceptance terms / sign-off declaration / quote footer
--   cubic_presets       — 25c: the cubic-calculator item catalog (name → cubic ft)
--   lead_provider_config— 26 : inbound lead-provider → acquisition_source mapping
-- Account Statement (26) needs no schema — it is derived from invoices/payments.
-- ============================================================

alter table settings add column if not exists document_text jsonb not null default '{}';
alter table settings add column if not exists cubic_presets jsonb not null default '[]';
alter table settings add column if not exists lead_provider_config jsonb not null default '[]';
