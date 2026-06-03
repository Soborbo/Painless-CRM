-- ============================================================
-- Phase 19: Job task checklist — ADR-028
-- ============================================================
-- The iMVE "Workflow" job page carries a lightweight Task Management checklist
-- per job (GAP_ANALYSIS.md A1, client-view). This is a flat checklist — no
-- dependencies, no sub-tasks, no assignment workflow — deliberately scoped to
-- match iMVE (ADR-028). The columns assigned_to_id / due_date / sort_order are
-- provisioned now so a later phase can layer assignment / ordering UI without a
-- second migration.
--
-- The Admin-vs-Staff notes split (the other half of Phase 19) needs NO schema
-- change: `notes.category` (admin/staff/customer_visible) already exists from
-- Phase 02. Only tasks are new here.
-- ============================================================

create table if not exists job_tasks (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id),
  job_id uuid not null references jobs(id),
  title text not null,
  done boolean not null default false,
  done_at timestamptz,
  due_date date,
  assigned_to_id uuid references users(id),
  sort_order int not null default 0,
  created_by_id uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version int not null default 1
);

-- Per-job ordered lookup for the checklist card.
create index if not exists job_tasks_job_idx
  on job_tasks (job_id, sort_order, created_at)
  where deleted_at is null;

-- Keep updated_at fresh on write (set_updated_at() defined in migration 02).
drop trigger if exists job_tasks_set_updated_at on job_tasks;
create trigger job_tasks_set_updated_at
  before update on job_tasks
  for each row execute function set_updated_at();

-- Tenant isolation — Pattern 1, replicated inline because the Section E bulk
-- loop in migration 03 ran before this table existed (mirrors that policy:
-- soft-deleted rows stay visible to admins only).
alter table job_tasks enable row level security;
drop policy if exists job_tasks_tenant on job_tasks;
create policy job_tasks_tenant on job_tasks
  for all to authenticated
  using (
    company_id = public.current_user_company_id()
    and (deleted_at is null or public.current_user_is_admin())
  )
  with check (company_id = public.current_user_company_id());
