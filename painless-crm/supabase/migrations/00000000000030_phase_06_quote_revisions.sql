-- ============================================================
-- Phase 06: Quote revisions
-- ============================================================
-- Lossless re-issue: every quote is the head of a chain that
-- points to the prior revision via revised_from_id. The
-- revision_number is denormalised so the UI can render
-- "Rev. N" without recursing the chain on every read.
-- ============================================================

alter table quotes
  add column if not exists revised_from_id uuid references quotes(id),
  add column if not exists revision_number int not null default 1;

create index if not exists quotes_revised_from_idx
  on quotes(revised_from_id)
  where deleted_at is null and revised_from_id is not null;

comment on column quotes.revised_from_id is
  'Pointer to the immediate predecessor quote, when this row was created via the "Revise" flow. Null for the original quote in a chain.';
comment on column quotes.revision_number is
  'Denormalised position in the revision chain (1 = original). Set by createQuoteForJob from the parents revision_number + 1.';
