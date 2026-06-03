-- ============================================================
-- Phase 22: Appointments calendar + Staff Holiday — ADR-031
-- ============================================================
-- The iMVE Calendar Overview (GAP_ANALYSIS.md A1 calendar-view) is a general
-- appointments diary distinct from job_assignments (ops crew scheduling) and
-- capacity (availability bands). Two thin tables:
--   appointments  — a dated diary entry, optionally linked to a job/customer.
--   staff_holidays — a worker's time off, surfaced on the dispatcher board and
--                    capacity so we don't schedule over it.
-- Both follow the standard tenant spine (RLS Pattern-1, set_updated_at,
-- soft delete, optimistic version). See ADR-031.
-- ============================================================

create table if not exists appointments (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id),
  title text not null,
  category text not null default 'other'
    check (category in ('survey', 'move', 'callback', 'meeting', 'other')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  all_day boolean not null default false,
  job_id uuid references jobs(id),
  customer_id uuid references customers(id),
  assigned_to_id uuid references users(id),
  notes text,
  created_by_id uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version int not null default 1
);

create index if not exists appointments_window_idx
  on appointments (company_id, starts_at)
  where deleted_at is null;

create table if not exists staff_holidays (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id),
  worker_id uuid not null references workers(id),
  start_date date not null,
  end_date date not null,
  kind text not null default 'holiday'
    check (kind in ('holiday', 'sick', 'training', 'other')),
  notes text,
  created_by_id uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version int not null default 1
);

create index if not exists staff_holidays_window_idx
  on staff_holidays (company_id, start_date, end_date)
  where deleted_at is null;

-- Keep updated_at fresh (set_updated_at() defined in migration 02).
drop trigger if exists appointments_set_updated_at on appointments;
create trigger appointments_set_updated_at
  before update on appointments
  for each row execute function set_updated_at();

drop trigger if exists staff_holidays_set_updated_at on staff_holidays;
create trigger staff_holidays_set_updated_at
  before update on staff_holidays
  for each row execute function set_updated_at();

-- Tenant isolation — Pattern 1, inline (the migration-03 Section E loop predates
-- these tables; soft-deleted rows visible to admins only).
alter table appointments enable row level security;
drop policy if exists appointments_tenant on appointments;
create policy appointments_tenant on appointments
  for all to authenticated
  using (
    company_id = public.current_user_company_id()
    and (deleted_at is null or public.current_user_is_admin())
  )
  with check (company_id = public.current_user_company_id());

alter table staff_holidays enable row level security;
drop policy if exists staff_holidays_tenant on staff_holidays;
create policy staff_holidays_tenant on staff_holidays
  for all to authenticated
  using (
    company_id = public.current_user_company_id()
    and (deleted_at is null or public.current_user_is_admin())
  )
  with check (company_id = public.current_user_company_id());
