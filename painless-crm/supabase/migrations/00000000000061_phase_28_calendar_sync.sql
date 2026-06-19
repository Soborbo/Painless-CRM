-- ============================================================
-- Phase 28: Calendar sync — ADR-045
-- ============================================================
-- Push the full job brief (not just date/time) to role-segmented Google
-- calendars the crew already carry. This migration adds the structured fields
-- the brief was missing plus the event-mapping spine:
--   1. cubic_sheet_items.reassembly_required — per item, mirrors dismantle.
--   2. job_brief_items — the kit list + the "not going" list, one table with a
--      `kind` discriminator (cf. unified tasks ADR-042). Distinct from
--      job_sheets.materials_used (the crew's *actual* post-job record).
--   3. calendar_links — maps a survey / move to its external calendar event so
--      a re-run patches instead of duplicating, and a cancel can delete it.
-- No-op safe: nothing here depends on Google credentials being present.
-- ============================================================

-- 1. Per-item reassembly flag (mirrors the existing dismantle_required) -------
alter table cubic_sheet_items
  add column if not exists reassembly_required boolean default false;

-- 2. Structured kit / excluded lists -----------------------------------------
create table if not exists job_brief_items (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id),
  job_id uuid not null references jobs(id) on delete cascade,

  -- kit = materials to bring (protectors, mattress/TV bags);
  -- excluded = items the customer is NOT taking ("not going").
  kind text not null check (kind in ('kit', 'excluded')),
  item text not null,
  quantity int not null default 1,
  notes text,
  sort_order int not null default 0,

  created_by_id uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version int not null default 1
);

-- Per-job editor read: the two lists, ordered.
create index if not exists job_brief_items_job_idx
  on job_brief_items (job_id, kind, sort_order)
  where deleted_at is null;

alter table job_brief_items enable row level security;
drop policy if exists job_brief_items_tenant on job_brief_items;
create policy job_brief_items_tenant on job_brief_items
  for all to authenticated
  using (
    company_id = public.current_user_company_id()
    and (deleted_at is null or public.current_user_is_admin())
  )
  with check (company_id = public.current_user_company_id());

drop trigger if exists job_brief_items_set_updated_at on job_brief_items;
create trigger job_brief_items_set_updated_at
  before update on job_brief_items
  for each row execute function set_updated_at();

-- 3. Calendar event mapping (idempotency + update/delete spine) ---------------
create table if not exists calendar_links (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id),

  entity_type text not null check (entity_type in ('survey', 'job_move')),
  entity_id uuid not null,
  provider text not null default 'google',
  calendar_id text not null,

  external_event_id text,
  etag text,
  html_link text,
  status text not null default 'pending'
    check (status in ('pending', 'synced', 'failed', 'deleted')),
  last_synced_at timestamptz,
  last_error text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version int not null default 1,

  -- one live link per entity per provider: a re-run patches the same event.
  unique (company_id, provider, entity_type, entity_id)
);

-- Drain queue: links still needing a push, oldest first.
create index if not exists calendar_links_pending_idx
  on calendar_links (company_id, status, updated_at)
  where deleted_at is null and status in ('pending', 'failed');

alter table calendar_links enable row level security;
drop policy if exists calendar_links_tenant on calendar_links;
create policy calendar_links_tenant on calendar_links
  for all to authenticated
  using (
    company_id = public.current_user_company_id()
    and (deleted_at is null or public.current_user_is_admin())
  )
  with check (company_id = public.current_user_company_id());

drop trigger if exists calendar_links_set_updated_at on calendar_links;
create trigger calendar_links_set_updated_at
  before update on calendar_links
  for each row execute function set_updated_at();
