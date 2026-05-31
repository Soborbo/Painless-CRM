-- ============================================================
-- Phase 06b §4 follow-up: call-back completion flag
-- ============================================================
-- Migration 36 added `next_action` + `next_action_due_at` so a call can
-- schedule a follow-up, and the owner home / call-back queue surface those due
-- today. But there was no way to mark a follow-up *done*, so overdue call-backs
-- could never be cleared and a rolling "all open" view would only ever grow.
--
-- This adds the done-flag (`next_action_completed_at`) plus who cleared it, so
-- the queue can safely surface overdue call-backs too: a completed follow-up
-- drops out of the open set. `phone_calls` is not a spine table, so no ADR is
-- required; RLS already covers it (phase 03 Section E, `for all` tenant scope),
-- which permits the authenticated UPDATE the completion action issues.
-- ============================================================

alter table phone_calls add column if not exists next_action_completed_at timestamptz;
alter table phone_calls add column if not exists next_action_completed_by_id uuid references users(id);

-- The hot path is *open* follow-ups (a due date that has not been completed).
-- Replace migration 36's plain "has a due date" partial index with one that
-- also excludes completed rows, so the queue scan stays tight.
drop index if exists phone_calls_next_action_due_idx;
create index if not exists phone_calls_open_callback_idx
  on phone_calls (next_action_due_at)
  where next_action_due_at is not null and next_action_completed_at is null;
