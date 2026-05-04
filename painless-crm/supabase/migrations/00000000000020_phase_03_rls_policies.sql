-- ============================================================
-- Phase 03: Row-Level Security
-- ============================================================
-- Multi-tenant isolation, role-aware access, worker scoping,
-- and Supabase advisor hardening (search_path, anon revoke,
-- security_invoker view, extensions schema).
-- ============================================================

-- ----- Section A: Helper functions -----

alter function public.set_updated_at() set search_path = public, pg_catalog;
alter function public.log_activity() set search_path = public, pg_catalog;
alter function public.set_invoice_lines_company_id() set search_path = public, pg_catalog;
alter function public.customer_lifetime_value(uuid) set search_path = public, pg_catalog;
alter function public.find_duplicate_candidates(text, text, text) set search_path = public, pg_catalog;
alter function public.current_user_company_id() set search_path = public, pg_catalog;

revoke all on function public.current_user_company_id() from public;
revoke all on function public.current_user_company_id() from anon;
grant execute on function public.current_user_company_id() to authenticated, service_role;

revoke all on function public.customer_lifetime_value(uuid) from public;
revoke all on function public.customer_lifetime_value(uuid) from anon;
grant execute on function public.customer_lifetime_value(uuid) to authenticated, service_role;

revoke all on function public.find_duplicate_candidates(text, text, text) from public;
revoke all on function public.find_duplicate_candidates(text, text, text) from anon;
grant execute on function public.find_duplicate_candidates(text, text, text) to authenticated, service_role;

revoke all on function public.log_activity() from public;
revoke all on function public.log_activity() from anon;
revoke all on function public.log_activity() from authenticated;

create or replace function public.current_user_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select id from public.users where auth_id = auth.uid() limit 1
$$;

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select role from public.users where auth_id = auth.uid() limit 1
$$;

create or replace function public.current_user_has_role(p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select exists(
    select 1 from public.users
    where auth_id = auth.uid() and role = any(p_roles)
  )
$$;

create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select exists(
    select 1 from public.users
    where auth_id = auth.uid() and role in ('admin','super_admin')
  )
$$;

create or replace function public.current_user_worker_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select w.id
  from public.workers w
  join public.users u on u.id = w.user_id
  where u.auth_id = auth.uid()
  limit 1
$$;

revoke all on function public.current_user_id() from public;
revoke all on function public.current_user_id() from anon;
grant execute on function public.current_user_id() to authenticated, service_role;

revoke all on function public.current_user_role() from public;
revoke all on function public.current_user_role() from anon;
grant execute on function public.current_user_role() to authenticated, service_role;

revoke all on function public.current_user_has_role(text[]) from public;
revoke all on function public.current_user_has_role(text[]) from anon;
grant execute on function public.current_user_has_role(text[]) to authenticated, service_role;

revoke all on function public.current_user_is_admin() from public;
revoke all on function public.current_user_is_admin() from anon;
grant execute on function public.current_user_is_admin() to authenticated, service_role;

revoke all on function public.current_user_worker_id() from public;
revoke all on function public.current_user_worker_id() from anon;
grant execute on function public.current_user_worker_id() to authenticated, service_role;

-- ----- Section B: pg_trgm to extensions schema -----

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'extensions') then
    begin
      execute 'alter extension pg_trgm set schema extensions';
    exception when others then
      raise notice 'pg_trgm relocation skipped: %', SQLERRM;
    end;
  end if;
end$$;

-- ----- Section C: payments_with_balance security_invoker -----

alter view public.payments_with_balance set (security_invoker = true);

-- ----- Section D: Refine existing RLS on companies, users, activity_log -----

drop policy if exists "companies read own" on public.companies;
drop policy if exists companies_select_own on public.companies;
drop policy if exists companies_admin_update on public.companies;
create policy companies_select_own on public.companies for select to authenticated
  using (id = public.current_user_company_id());
create policy companies_admin_update on public.companies for update to authenticated
  using (id = public.current_user_company_id() and public.current_user_is_admin())
  with check (id = public.current_user_company_id() and public.current_user_is_admin());

drop policy if exists "users read own row" on public.users;
drop policy if exists users_select_self on public.users;
drop policy if exists users_select_tenant_admin on public.users;
drop policy if exists users_admin_modify on public.users;
create policy users_select_self on public.users for select to authenticated
  using (auth_id = auth.uid());
create policy users_select_tenant_admin on public.users for select to authenticated
  using (company_id = public.current_user_company_id() and public.current_user_is_admin());
create policy users_admin_modify on public.users for all to authenticated
  using (company_id = public.current_user_company_id() and public.current_user_is_admin())
  with check (company_id = public.current_user_company_id() and public.current_user_is_admin());

drop policy if exists "activity_log read own tenant" on public.activity_log;
drop policy if exists activity_log_select_tenant on public.activity_log;
create policy activity_log_select_tenant on public.activity_log for select to authenticated
  using (company_id = public.current_user_company_id());
revoke insert, update, delete on public.activity_log from anon, authenticated;

-- ----- Section E: Bulk tenant isolation (Pattern 1) -----

do $$
declare
  t text;
  has_deleted_at boolean;
  tenant_tables text[] := array[
    'addresses', 'customers', 'customer_contacts', 'customer_relationships', 'customer_consents',
    'job_addresses', 'job_status_history', 'job_tags',
    'quotes', 'quote_variants', 'quote_acceptances', 'capacity_overrides',
    'vehicles', 'vehicle_assignments', 'worker_availability', 'job_assignments',
    'storage_sites', 'storage_containers', 'storage_rentals',
    'surveys', 'cubic_sheet_items',
    'notes', 'customer_signoffs', 'review_requests', 'complaints', 'damage_claims',
    'invoices', 'invoice_lines', 'payments', 'payment_allocations', 'direct_debit_mandates',
    'messages', 'phone_calls',
    'attributions', 'commission_records',
    'documents', 'offline_conversion_uploads',
    'workers',
    'photos'
  ];
begin
  foreach t in array tenant_tables loop
    execute format('alter table public.%I enable row level security', t);
    select exists(
      select 1 from information_schema.columns
      where table_schema='public' and table_name=t and column_name='deleted_at'
    ) into has_deleted_at;
    execute format('drop policy if exists %I on public.%I', t || '_tenant', t);
    if has_deleted_at then
      execute format($f$
        create policy %I on public.%I
          for all to authenticated
          using (
            company_id = public.current_user_company_id()
            and (deleted_at is null or public.current_user_is_admin())
          )
          with check (company_id = public.current_user_company_id())
      $f$, t || '_tenant', t);
    else
      execute format($f$
        create policy %I on public.%I
          for all to authenticated
          using (company_id = public.current_user_company_id())
          with check (company_id = public.current_user_company_id())
      $f$, t || '_tenant', t);
    end if;
  end loop;
end$$;

-- ----- Section F: Pattern 3 - admin/manager modify, tenant read -----

do $$
declare
  t text;
  has_deleted_at boolean;
  tables text[] := array[
    'settings', 'pricing_versions', 'automation_rules',
    'affiliates', 'affiliate_codes',
    'email_templates', 'sms_templates', 'whatsapp_templates'
  ];
begin
  foreach t in array tables loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_read', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin_modify', t);

    select exists(
      select 1 from information_schema.columns
      where table_schema='public' and table_name=t and column_name='deleted_at'
    ) into has_deleted_at;

    if has_deleted_at then
      execute format($f$
        create policy %I on public.%I for select to authenticated
          using (
            company_id = public.current_user_company_id()
            and (deleted_at is null or public.current_user_is_admin())
          )
      $f$, t || '_read', t);
    else
      execute format($f$
        create policy %I on public.%I for select to authenticated
          using (company_id = public.current_user_company_id())
      $f$, t || '_read', t);
    end if;

    execute format($f$
      create policy %I on public.%I for all to authenticated
        using (
          company_id = public.current_user_company_id()
          and public.current_user_has_role(array['admin','super_admin','manager'])
        )
        with check (
          company_id = public.current_user_company_id()
          and public.current_user_has_role(array['admin','super_admin','manager'])
        )
    $f$, t || '_admin_modify', t);
  end loop;
end$$;

-- ----- Section G: Pattern 4 - jobs and worker-scoped child tables -----

alter table public.jobs enable row level security;
drop policy if exists jobs_office on public.jobs;
drop policy if exists jobs_loader_assigned on public.jobs;
create policy jobs_office on public.jobs for all to authenticated
  using (
    company_id = public.current_user_company_id()
    and public.current_user_has_role(array['admin','super_admin','manager','sales','dispatcher','accountant'])
    and (deleted_at is null or public.current_user_is_admin())
  )
  with check (
    company_id = public.current_user_company_id()
    and public.current_user_has_role(array['admin','super_admin','manager','sales','dispatcher','accountant'])
  );
create policy jobs_loader_assigned on public.jobs for select to authenticated
  using (
    company_id = public.current_user_company_id()
    and deleted_at is null
    and public.current_user_has_role(array['loader'])
    and exists (
      select 1 from public.job_assignments ja
      where ja.job_id = jobs.id
        and ja.worker_id = public.current_user_worker_id()
        and ja.deleted_at is null
    )
  );

alter table public.time_entries enable row level security;
drop policy if exists time_entries_office on public.time_entries;
drop policy if exists time_entries_worker on public.time_entries;
create policy time_entries_office on public.time_entries for all to authenticated
  using (
    company_id = public.current_user_company_id()
    and public.current_user_has_role(array['admin','super_admin','manager','dispatcher','accountant'])
    and (deleted_at is null or public.current_user_is_admin())
  )
  with check (
    company_id = public.current_user_company_id()
    and public.current_user_has_role(array['admin','super_admin','manager','dispatcher','accountant'])
  );
create policy time_entries_worker on public.time_entries for all to authenticated
  using (
    company_id = public.current_user_company_id()
    and worker_id = public.current_user_worker_id()
    and deleted_at is null
  )
  with check (
    company_id = public.current_user_company_id()
    and worker_id = public.current_user_worker_id()
  );

alter table public.vehicle_checks enable row level security;
drop policy if exists vehicle_checks_office on public.vehicle_checks;
drop policy if exists vehicle_checks_worker on public.vehicle_checks;
create policy vehicle_checks_office on public.vehicle_checks for all to authenticated
  using (
    company_id = public.current_user_company_id()
    and public.current_user_has_role(array['admin','super_admin','manager','dispatcher','accountant'])
    and (deleted_at is null or public.current_user_is_admin())
  )
  with check (
    company_id = public.current_user_company_id()
    and public.current_user_has_role(array['admin','super_admin','manager','dispatcher','accountant'])
  );
create policy vehicle_checks_worker on public.vehicle_checks for all to authenticated
  using (
    company_id = public.current_user_company_id()
    and worker_id = public.current_user_worker_id()
    and deleted_at is null
  )
  with check (
    company_id = public.current_user_company_id()
    and worker_id = public.current_user_worker_id()
  );

alter table public.job_sheets enable row level security;
drop policy if exists job_sheets_office on public.job_sheets;
drop policy if exists job_sheets_worker on public.job_sheets;
create policy job_sheets_office on public.job_sheets for all to authenticated
  using (
    company_id = public.current_user_company_id()
    and public.current_user_has_role(array['admin','super_admin','manager','dispatcher','accountant'])
    and (deleted_at is null or public.current_user_is_admin())
  )
  with check (
    company_id = public.current_user_company_id()
    and public.current_user_has_role(array['admin','super_admin','manager','dispatcher','accountant'])
  );
create policy job_sheets_worker on public.job_sheets for all to authenticated
  using (
    company_id = public.current_user_company_id()
    and worker_id = public.current_user_worker_id()
    and deleted_at is null
  )
  with check (
    company_id = public.current_user_company_id()
    and worker_id = public.current_user_worker_id()
  );

-- ----- Section H: Special tables -----

alter table public.notifications enable row level security;
drop policy if exists notifications_recipient_read on public.notifications;
drop policy if exists notifications_recipient_update on public.notifications;
drop policy if exists notifications_admin on public.notifications;
create policy notifications_recipient_read on public.notifications for select to authenticated
  using (
    company_id = public.current_user_company_id()
    and recipient_user_id = public.current_user_id()
  );
create policy notifications_recipient_update on public.notifications for update to authenticated
  using (
    company_id = public.current_user_company_id()
    and recipient_user_id = public.current_user_id()
  )
  with check (
    company_id = public.current_user_company_id()
    and recipient_user_id = public.current_user_id()
  );
create policy notifications_admin on public.notifications for all to authenticated
  using (
    company_id = public.current_user_company_id()
    and public.current_user_is_admin()
  )
  with check (
    company_id = public.current_user_company_id()
    and public.current_user_is_admin()
  );

alter table public.notification_preferences enable row level security;
drop policy if exists notification_preferences_self on public.notification_preferences;
create policy notification_preferences_self on public.notification_preferences for all to authenticated
  using (
    company_id = public.current_user_company_id()
    and user_id = public.current_user_id()
  )
  with check (
    company_id = public.current_user_company_id()
    and user_id = public.current_user_id()
  );

alter table public.presence enable row level security;
drop policy if exists presence_tenant_read on public.presence;
drop policy if exists presence_self_write on public.presence;
create policy presence_tenant_read on public.presence for select to authenticated
  using (company_id = public.current_user_company_id());
create policy presence_self_write on public.presence for all to authenticated
  using (
    company_id = public.current_user_company_id()
    and user_id = public.current_user_id()
  )
  with check (
    company_id = public.current_user_company_id()
    and user_id = public.current_user_id()
  );

alter table public.integration_credentials enable row level security;
drop policy if exists integration_credentials_admin on public.integration_credentials;
create policy integration_credentials_admin on public.integration_credentials for all to authenticated
  using (
    company_id = public.current_user_company_id()
    and public.current_user_is_admin()
    and (deleted_at is null or public.current_user_is_admin())
  )
  with check (
    company_id = public.current_user_company_id()
    and public.current_user_is_admin()
  );
revoke all on public.integration_credentials from anon;

alter table public.integration_credential_access_log enable row level security;
drop policy if exists icl_admin_read on public.integration_credential_access_log;
create policy icl_admin_read on public.integration_credential_access_log for select to authenticated
  using (
    company_id = public.current_user_company_id()
    and public.current_user_is_admin()
  );
revoke insert, update, delete on public.integration_credential_access_log from anon, authenticated;
revoke all on public.integration_credential_access_log from anon;

alter table public.webhook_events enable row level security;
drop policy if exists webhook_events_admin_read on public.webhook_events;
create policy webhook_events_admin_read on public.webhook_events for select to authenticated
  using (
    company_id = public.current_user_company_id()
    and public.current_user_has_role(array['admin','super_admin','manager'])
  );
revoke insert, update, delete on public.webhook_events from anon, authenticated;

alter table public.automation_queue enable row level security;
drop policy if exists automation_queue_admin_read on public.automation_queue;
create policy automation_queue_admin_read on public.automation_queue for select to authenticated
  using (
    company_id = public.current_user_company_id()
    and public.current_user_has_role(array['admin','super_admin','manager'])
  );
revoke insert, update, delete on public.automation_queue from anon, authenticated;

alter table public.user_invitations enable row level security;
drop policy if exists user_invitations_admin on public.user_invitations;
create policy user_invitations_admin on public.user_invitations for all to authenticated
  using (
    company_id = public.current_user_company_id()
    and public.current_user_is_admin()
  )
  with check (
    company_id = public.current_user_company_id()
    and public.current_user_is_admin()
  );
revoke all on public.user_invitations from anon;

-- ----- Section I: Block anon from all public base tables -----
-- This CRM has no anon-facing tables; public flows go through Edge Functions
-- with the service_role key. Belt-and-braces in addition to RLS.

do $$
declare
  t text;
begin
  for t in
    select table_name from information_schema.tables
    where table_schema='public' and table_type='BASE TABLE'
  loop
    execute format('revoke all on public.%I from anon', t);
  end loop;
end$$;
