-- ============================================================
-- Phase 06b §4: Manual call log — outcome + call-back reminder fields
-- ============================================================
-- The phone_calls table shipped with the basics (direction, timing, numbers,
-- notes) but §4 also calls for an `outcome` classification and a follow-up
-- action with a due date, which drive call-back reminders. Adding them here.
--
-- `outcome` is free text at the DB layer (the Zod enum in
-- lib/schemas/phone-call.ts is the source of truth for allowed values) so a
-- future Tamar API source can record outcomes we haven't enumerated yet
-- without a migration. RLS already covers this table (phase 03 Section E).
-- ============================================================

alter table phone_calls add column if not exists outcome text;
alter table phone_calls add column if not exists next_action text;
alter table phone_calls add column if not exists next_action_due_at timestamptz;

-- Partial index for the "call-backs due" surface: only rows that actually
-- have a pending follow-up are worth scanning.
create index if not exists phone_calls_next_action_due_idx
  on phone_calls (next_action_due_at)
  where next_action_due_at is not null;
