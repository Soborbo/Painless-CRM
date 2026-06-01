-- ============================================================
-- Phase 08: worker skills / certifications
-- ============================================================
-- Phase 08 §Workers deliverable #9 lists "skills/certifications" on the worker
-- profile, but the workers table (Phase 02) has no field for it. Add a free-text
-- column (comma-separated in the UI) — a structured skills taxonomy is a later
-- concern; for v0.2 a searchable note is enough.
-- ============================================================

alter table workers add column if not exists skills text;
