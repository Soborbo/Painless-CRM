-- ============================================================
-- Phase 06b §7: Document vault (light) — ADR-018
-- ============================================================
-- The `documents` metadata table already exists (phase 02) and already
-- receives tenant RLS via the bulk Section E loop in phase 03. This migration
-- only provisions the Storage side: a private bucket plus per-tenant object
-- policies so the file bytes are isolated the same way the rows are.
--
-- Object key layout (set by the upload Server Action):
--   {company_id}/documents/{document_id}/{filename}
-- so (storage.foldername(name))[1] is always the owning company_id.
-- ============================================================

-- ----- Private bucket -----

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- ----- Per-tenant object isolation -----
-- Authenticated office users only touch objects under their own company
-- folder. The public quote-acceptance page never reads bytes directly — it
-- goes through the service-role client (which bypasses these policies) to
-- mint short-lived signed URLs, so no anon policy is needed here.

drop policy if exists documents_objects_read on storage.objects;
create policy documents_objects_read on storage.objects for select to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = public.current_user_company_id()::text
  );

drop policy if exists documents_objects_insert on storage.objects;
create policy documents_objects_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = public.current_user_company_id()::text
  );

drop policy if exists documents_objects_update on storage.objects;
create policy documents_objects_update on storage.objects for update to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = public.current_user_company_id()::text
  )
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = public.current_user_company_id()::text
  );

drop policy if exists documents_objects_delete on storage.objects;
create policy documents_objects_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = public.current_user_company_id()::text
  );
