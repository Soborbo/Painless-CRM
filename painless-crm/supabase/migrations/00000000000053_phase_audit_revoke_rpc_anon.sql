-- Audit fix follow-up — lock down the SECURITY DEFINER functions added in
-- migration 51. Postgres grants EXECUTE to PUBLIC by default, so without an
-- explicit revoke the anon role could call record_payment via PostgREST RPC —
-- and record_payment bypasses RLS, so an unauthenticated caller could forge
-- payments/allocations for any company_id. Mirror the revoke pattern the
-- current_user_* helpers use (migration 20). Caught by the Supabase security
-- advisor (anon_security_definer_function_executable).

revoke all on function public.record_payment(uuid, uuid, int, text, timestamptz, text, uuid)
  from public, anon;
grant execute on function public.record_payment(uuid, uuid, int, text, timestamptz, text, uuid)
  to authenticated, service_role;

-- assert_invoice_not_overpaid is a trigger function; it never needs to be
-- callable directly. Trigger execution does not depend on EXECUTE grants.
revoke all on function public.assert_invoice_not_overpaid() from public, anon, authenticated;
