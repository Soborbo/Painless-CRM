-- ============================================================
-- Phase 07: audit admin capacity overrides — ADR-022
-- ============================================================
-- Phase 07 acceptance: "Audit log captures every override." The universal
-- log_activity() trigger function already exists and is documented as safe to
-- attach to any table, but it isn't yet wired to capacity_overrides. Attach it
-- here so every set/clear of a forced band lands in activity_log. We only
-- ATTACH the existing function — the function body itself is untouched.
-- ============================================================

drop trigger if exists capacity_overrides_audit on capacity_overrides;
create trigger capacity_overrides_audit
  after insert or update or delete on capacity_overrides
  for each row execute function log_activity();
