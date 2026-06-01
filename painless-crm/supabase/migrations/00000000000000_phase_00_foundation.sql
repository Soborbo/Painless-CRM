-- Phase 00 — Foundation bootstrap migration.
-- Creates the multi-tenant root (companies), user profiles linked to auth.users,
-- the RLS helper function `current_user_company_id()`, and the activity_log
-- audit trail. Domain tables land in Phase 02.

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

-- Companies (multi-tenant root)
create table if not exists public.companies (
  id uuid primary key default uuid_generate_v4(),
  slug text unique not null,
  name text not null,
  status text not null default 'active' check (status in ('active', 'suspended', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Seed Painless tenant
insert into public.companies (id, slug, name)
values ('00000000-0000-0000-0000-000000000001', 'painless', 'Painless Removals')
on conflict (id) do nothing;

-- Users — extends auth.users with tenant + role
create table if not exists public.users (
  id uuid primary key default uuid_generate_v4(),
  auth_id uuid unique not null references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete restrict,
  email text not null,
  full_name text not null,
  role text not null check (role in (
    'super_admin', 'admin', 'manager', 'sales', 'surveyor', 'loader', 'accounts', 'viewer'
  )),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists users_auth_id_idx on public.users(auth_id);
create index if not exists users_company_id_idx on public.users(company_id);

-- RLS helper — resolves tenant from the JWT-authenticated user
create or replace function public.current_user_company_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select company_id from public.users where auth_id = auth.uid() limit 1
$$;

-- Activity log (audit trail)
create table if not exists public.activity_log (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.companies(id),
  entity_type text not null,
  entity_id uuid not null,
  action text not null, -- 'create' | 'update' | 'delete' | 'soft_delete' | custom verbs
  before jsonb,
  after jsonb,
  actor_id uuid references public.users(id),
  actor_label text, -- fallback when actor_id is null (system, webhook)
  occurred_at timestamptz not null default now(),
  ip_address inet,
  user_agent text
);

create index if not exists activity_log_company_id_idx on public.activity_log(company_id);
create index if not exists activity_log_entity_idx on public.activity_log(entity_type, entity_id);
create index if not exists activity_log_occurred_at_idx on public.activity_log(occurred_at desc);

-- RLS — Phase 01 fleshes these out per SECURITY_MODEL.md.
alter table public.companies enable row level security;
alter table public.users enable row level security;
alter table public.activity_log enable row level security;

-- Read-own-tenant policies (minimum viable for Phase 00 dashboard query).
create policy "users read own row" on public.users
  for select using (auth_id = auth.uid());

create policy "companies read own" on public.companies
  for select using (id = public.current_user_company_id());

create policy "activity_log read own tenant" on public.activity_log
  for select using (company_id = public.current_user_company_id());
