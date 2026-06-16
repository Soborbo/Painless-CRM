-- ============================================================
-- Phase 27: Unified tasks — ADR-042
-- ============================================================
-- One actionable-task entity, polymorphically linked to any record
-- (customer/job/quote/complaint/phone_call), with a `kind` discriminator
-- (followup|checklist|call) plus priority, status and a datetime due that
-- the prior two to-do systems lacked.
--
-- This migration:
--   1. creates `tasks` + `task_assignees` (multi-assignee join),
--   2. backfills the open call-back queue (phone_calls.next_action*) and the
--      per-job checklist (job_tasks) into `tasks`,
--   3. DROPS `job_tasks` — its UI is re-pointed at `tasks` in the same PR.
-- phone_calls.next_action* columns are kept as call history; `tasks` now owns
-- the actionable follow-up queue.
-- ============================================================

create table if not exists tasks (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id),

  -- polymorphic link (nullable: a task can be standalone)
  related_type text check (related_type in
    ('customer', 'job', 'quote', 'complaint', 'phone_call')),
  related_id uuid,

  -- denormalized owners for fast queue / entity-panel reads
  customer_id uuid references customers(id),
  job_id uuid references jobs(id),

  kind text not null default 'followup'
    check (kind in ('followup', 'checklist', 'call')),
  title text not null,
  description text,
  priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high')),
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'done', 'cancelled')),
  due_at timestamptz,

  sort_order int not null default 0,

  completed_at timestamptz,
  completed_by_id uuid references users(id),
  created_by_id uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version int not null default 1,

  -- temporary: correlates backfilled rows to legacy job_tasks for the
  -- assignee backfill below. Dropped at the end of this migration.
  legacy_job_task_id uuid
);

create table if not exists task_assignees (
  task_id uuid not null references tasks(id) on delete cascade,
  user_id uuid not null references users(id),
  company_id uuid not null references companies(id),
  created_at timestamptz not null default now(),
  primary key (task_id, user_id)
);

-- My-queue: open tasks for a user, by urgency (reverse lookup via join table).
create index if not exists task_assignees_user_idx
  on task_assignees (user_id, company_id);

-- Company-wide due-today / overdue counts (home widget).
create index if not exists tasks_company_due_idx
  on tasks (company_id, status, due_at)
  where deleted_at is null;

-- Per-job checklist (ordered).
create index if not exists tasks_job_checklist_idx
  on tasks (job_id, kind, sort_order)
  where deleted_at is null;

-- Entity-panel lookup.
create index if not exists tasks_related_idx
  on tasks (related_type, related_id)
  where deleted_at is null;

alter table tasks enable row level security;
drop policy if exists tasks_tenant on tasks;
create policy tasks_tenant on tasks
  for all to authenticated
  using (
    company_id = public.current_user_company_id()
    and (deleted_at is null or public.current_user_is_admin())
  )
  with check (company_id = public.current_user_company_id());

alter table task_assignees enable row level security;
drop policy if exists task_assignees_tenant on task_assignees;
create policy task_assignees_tenant on task_assignees
  for all to authenticated
  using (company_id = public.current_user_company_id())
  with check (company_id = public.current_user_company_id());

drop trigger if exists tasks_set_updated_at on tasks;
create trigger tasks_set_updated_at
  before update on tasks
  for each row execute function set_updated_at();

-- ============================================================
-- Backfill 1: open call-backs → tasks (kind = 'call')
-- phone_calls has no deleted_at; an open call-back is one with a due date set
-- and no completion. The whole open worklist is migrated, not just today's.
-- ============================================================
insert into tasks (
  company_id, related_type, related_id, customer_id, job_id,
  kind, title, priority, status, due_at, created_by_id, created_at
)
select
  pc.company_id, 'phone_call', pc.id, pc.customer_id, pc.job_id,
  'call', coalesce(nullif(btrim(pc.next_action), ''), 'Follow-up call'),
  'medium', 'open', pc.next_action_due_at, pc.user_id, pc.occurred_at
from phone_calls pc
where pc.next_action_due_at is not null
  and pc.next_action_completed_at is null;

-- The call's owner becomes the call-task assignee, when known.
insert into task_assignees (task_id, user_id, company_id)
select t.id, pc.user_id, t.company_id
from tasks t
join phone_calls pc on pc.id = t.related_id
where t.kind = 'call'
  and t.related_type = 'phone_call'
  and pc.user_id is not null
on conflict do nothing;

-- ============================================================
-- Backfill 2: per-job checklist (job_tasks) → tasks (kind = 'checklist')
-- ============================================================
insert into tasks (
  company_id, related_type, related_id, job_id, customer_id,
  kind, title, status, due_at, sort_order,
  completed_at, created_by_id, created_at, legacy_job_task_id
)
select
  jt.company_id, 'job', jt.job_id, jt.job_id, j.customer_id,
  'checklist', jt.title,
  case when jt.done then 'done' else 'open' end,
  case when jt.due_date is not null then jt.due_date::timestamptz else null end,
  jt.sort_order, jt.done_at, jt.created_by_id, jt.created_at, jt.id
from job_tasks jt
join jobs j on j.id = jt.job_id
where jt.deleted_at is null;

insert into task_assignees (task_id, user_id, company_id)
select t.id, jt.assigned_to_id, jt.company_id
from tasks t
join job_tasks jt on jt.id = t.legacy_job_task_id
where jt.assigned_to_id is not null
on conflict do nothing;

alter table tasks drop column legacy_job_task_id;

-- ============================================================
-- Drop the legacy per-job checklist table (backfilled above). The callbacks
-- queue's source columns (phone_calls.next_action*) are intentionally kept.
-- ============================================================
drop table if exists job_tasks cascade;
