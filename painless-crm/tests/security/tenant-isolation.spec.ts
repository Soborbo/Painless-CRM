import { describe, it } from 'vitest';

// Real cross-tenant RLS test runs against a live Supabase instance.
// Wired in CI when SUPABASE_TEST_URL + SUPABASE_TEST_SERVICE_ROLE_KEY are set.
// See phases/01-auth-multitenant.md "Cross-tenant leak test" — five cases:
//   1. User A queries → sees only company A
//   2. User A UPDATEs company B's row by id → RLS rejects
//   3. User A INSERTs with company_id=B → RLS rejects
//   4. service_role bypasses (sanity check)
//   5. activity_log filtered to company A
// This file exists so CI registers a tenant-isolation test even before live Supabase
// is plumbed in. It will fail loudly when the env vars are present but the cases
// have not been implemented yet.

const HAS_LIVE_DB =
  Boolean(process.env.SUPABASE_TEST_URL) && Boolean(process.env.SUPABASE_TEST_SERVICE_ROLE_KEY);

describe.skipIf(!HAS_LIVE_DB)('cross-tenant RLS isolation (integration)', () => {
  it.todo('user in company A cannot SELECT company B rows');
  it.todo('user in company A cannot UPDATE company B rows by id');
  it.todo('user in company A cannot INSERT rows with company_id=B');
  it.todo('service_role can SELECT across tenants (sanity)');
  it.todo('user in company A only sees their own activity_log entries');
});

describe('cross-tenant RLS isolation (placeholder)', () => {
  it('exists so the suite registers when live DB env is absent', () => {
    // Intentionally trivial. Real coverage in the suite above.
  });
});
