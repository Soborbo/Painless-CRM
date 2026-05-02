# Schema Contract

**Status:** canonical
**Last updated:** spec v2.1
**Related:** `references/schema.sql`, SECURITY_MODEL.md §2, ADR-007

This document defines, for **every table** in the schema, what doctrine rules apply. The previous v2 spec stated rules ("every mutable entity has `deleted_at` and `version`", "every business table has RLS") but didn't enforce table-by-table. This is the enforcement matrix. CI checks (`tests/schema/contract.test.ts`) verify reality matches.

---

## Legend

- **Scope:** `tenant` (per-company, has `company_id`), `system` (single row across the install, no `company_id`), `meta` (no application data — audit/log)
- **Mutable:** can rows ever be UPDATEd? (If no, only INSERT, never UPDATE/DELETE)
- **Soft del:** has `deleted_at` column? Hard delete is forbidden if yes.
- **Version:** has `version` column for optimistic concurrency?
- **Audit:** has `log_activity()` trigger attached?
- **RLS:** RLS pattern applied. `tenant` = standard `current_user_company_id()` filter; `tenant+role` = additional role gate; `system` = service-role-only writes; `none` = no RLS (audit/meta tables).
- **Owner:** which phase owns this table

---

## A. Core (Phase 0–1)

| Table | Scope | Mutable | Soft del | Version | Audit | RLS | Owner |
|-------|-------|---------|----------|---------|-------|-----|-------|
| `companies` | system | yes | no | yes | no | service-role only | Phase 01 |
| `users` | tenant | yes | yes | yes | yes | tenant+role | Phase 01 |
| `workers` | tenant | yes | yes | yes | yes | tenant | Phase 08 |
| `settings` | tenant | yes | yes | yes | yes | tenant+role(admin) | Phase 01 |
| `user_invitations` | tenant | yes | yes | yes | yes | tenant+role(admin) | Phase 01 |
| `activity_log` | meta | **no** | no | no | no | tenant (read-only) | Phase 01 |

`companies` is unaudited because it's the parent of every audit row — auditing it would create a chicken-and-egg. `activity_log` itself is unaudited (would recurse infinitely). Both are intentional NO_AUDIT.

## B. Customers (Phase 2–3)

| Table | Scope | Mutable | Soft del | Version | Audit | RLS | Owner |
|-------|-------|---------|----------|---------|-------|-----|-------|
| `addresses` | tenant | yes | yes | yes | yes | tenant | Phase 03 |
| `customers` | tenant | yes | yes | yes | yes | tenant | Phase 03 |
| `customer_contacts` | tenant | yes | yes | yes | yes | tenant | Phase 03 |
| `customer_relationships` | tenant | yes | yes | yes | yes | tenant | Phase 03 |
| `customer_consents` | tenant | yes | yes | yes | yes | tenant (GDPR) | Phase 03 |

## C. Jobs (Phase 4)

| Table | Scope | Mutable | Soft del | Version | Audit | RLS | Owner |
|-------|-------|---------|----------|---------|-------|-----|-------|
| `jobs` | tenant | yes | yes | yes | yes | tenant+role | Phase 04 |
| `job_addresses` | tenant | yes | yes | yes | yes | tenant | Phase 04 |
| `job_status_history` | tenant | **no** | no | no | no | tenant (insert-only) | Phase 04 |
| `job_tags` | tenant | yes | no | no | yes | tenant | Phase 04 |

`job_status_history` is **append-only** — once a transition is recorded, it's permanent. No UPDATE policy. Same applies to anything that's a state log.

## D. Pricing (Phase 5–6)

| Table | Scope | Mutable | Soft del | Version | Audit | RLS | Owner |
|-------|-------|---------|----------|---------|-------|-----|-------|
| `pricing_versions` | tenant | yes (only `is_active`, `migration_notes`) | yes | yes | yes | tenant+role(admin) | Phase 05 |
| `quotes` | tenant | yes (limited fields after issued) | yes | yes | yes | tenant+role | Phase 06 |
| `quote_variants` | tenant | yes | no | no | yes | tenant | Phase 06 |
| `quote_acceptances` | tenant | **no** | no | no | yes | tenant (insert-only) | Phase 06 |

Quote freeze: once a quote is issued (`status = 'issued'`), only `notes`, `internal_status`, and validity-extension fields can be updated. The `pricing_version_id`, `total_pence`, line items are immutable. Enforced by trigger.

## E. Capacity (Phase 7)

| Table | Scope | Mutable | Soft del | Version | Audit | RLS | Owner |
|-------|-------|---------|----------|---------|-------|-----|-------|
| `capacity_overrides` | tenant | yes | no | no | yes | tenant+role | Phase 07 |

## F. Resources (Phase 8)

| Table | Scope | Mutable | Soft del | Version | Audit | RLS | Owner |
|-------|-------|---------|----------|---------|-------|-----|-------|
| `vehicles` | tenant | yes | yes | yes | yes | tenant | Phase 08 |
| `vehicle_assignments` | tenant | yes | no | no | yes | tenant | Phase 08 |
| `worker_availability` | tenant | yes | no | no | yes | tenant | Phase 08 |
| `job_assignments` | tenant | yes | yes | yes | yes | tenant | Phase 08 |
| `storage_sites` | tenant | yes | no | no | yes | tenant+role | Phase 08 |
| `storage_containers` | tenant | yes | yes | yes | yes | tenant | Phase 08 |
| `storage_rentals` | tenant | yes | yes | yes | yes | tenant | Phase 08 |

## G. Operations (Phase 9–10)

| Table | Scope | Mutable | Soft del | Version | Audit | RLS | Owner |
|-------|-------|---------|----------|---------|-------|-----|-------|
| `time_entries` | tenant | yes (limited) | yes | yes | yes | tenant+worker_self | Phase 09 |
| `vehicle_checks` | tenant | yes | yes | yes | yes | tenant+worker_self | Phase 09 |
| `photos` | tenant | yes (metadata only) | yes | yes | yes | tenant | Phase 09 |
| `surveys` | tenant | yes | yes | yes | yes | tenant | Phase 10 |
| `cubic_sheet_items` | tenant | yes | no | no | yes | tenant | Phase 10 |
| `job_sheets` | tenant | yes | yes | yes | yes | tenant | Phase 10 |
| `notes` | tenant | yes | yes | yes | yes | tenant (visibility-aware) | Phase 04+ |

`notes` RLS has two read paths: `is_customer_visible = true` is readable by anyone with read access to the parent; `is_customer_visible = false` is admin-only.

## H. Sign-off & Reviews (Phase 11)

| Table | Scope | Mutable | Soft del | Version | Audit | RLS | Owner |
|-------|-------|---------|----------|---------|-------|-----|-------|
| `customer_signoffs` | tenant | yes | yes | yes | yes | tenant | Phase 11 |
| `review_requests` | tenant | yes | yes | yes | yes | tenant | Phase 11 |
| `complaints` | tenant | yes | yes | yes | yes | tenant+role | Phase 11 |
| `damage_claims` | tenant | yes | yes | yes | yes | tenant+role | Phase 11 |

## I. Money (Phase 12)

| Table | Scope | Mutable | Soft del | Version | Audit | RLS | Owner |
|-------|-------|---------|----------|---------|-------|-----|-------|
| `invoices` | tenant | yes | yes | yes | yes | tenant+role | Phase 12 |
| `invoice_lines` | tenant | yes | yes | yes | yes | tenant+role | Phase 12 |
| `payments` | tenant | yes | yes | yes | yes | tenant+role | Phase 12 |
| `payment_allocations` | tenant | yes | no | no | yes | tenant+role | Phase 12 |
| `direct_debit_mandates` | tenant | yes | yes | yes | yes | tenant | Phase 12 |

`payment_allocations` is non-soft-deletable — corrections happen via `reverses_allocation_id` reference (a new row that reverses an old one). Audit trail preserved.

## J. Communications (Phase 13)

| Table | Scope | Mutable | Soft del | Version | Audit | RLS | Owner |
|-------|-------|---------|----------|---------|-------|-----|-------|
| `email_templates` | tenant | yes | no | no | yes | tenant+role | Phase 13 |
| `sms_templates` | tenant | yes | no | no | yes | tenant+role | Phase 13 |
| `whatsapp_templates` | tenant | yes (limited) | no | no | yes | tenant+role | Phase 13 |
| `automation_rules` | tenant | yes | no | no | yes | tenant+role | Phase 13 |
| `automation_queue` | tenant | yes | no | no | no | tenant | Phase 13 |
| `messages` | tenant | yes (status only) | no | no | yes | tenant | Phase 13 |
| `phone_calls` | tenant | yes | no | no | yes | tenant | Phase 06b/13 |

WhatsApp templates can only update non-Meta-bound fields after Meta has approved them. Body changes require new approval.

## K. Affiliates (Phase 16)

| Table | Scope | Mutable | Soft del | Version | Audit | RLS | Owner |
|-------|-------|---------|----------|---------|-------|-----|-------|
| `affiliates` | tenant | yes | yes | yes | yes | tenant+role | Phase 16 |
| `affiliate_codes` | tenant | yes (status only) | no | no | yes | tenant | Phase 16 |
| `attributions` | tenant | **no** | no | no | yes | tenant (insert-only) | Phase 16 |
| `commission_records` | tenant | yes (status) | no | no | yes | tenant+role | Phase 16 |

## L. Notifications & presence (Phase 15)

| Table | Scope | Mutable | Soft del | Version | Audit | RLS | Owner |
|-------|-------|---------|----------|---------|-------|-----|-------|
| `notifications` | tenant | yes (read flag) | no | no | no | tenant+user_self | Phase 15 |
| `notification_preferences` | tenant | yes | no | no | no | tenant+user_self | Phase 15 |
| `presence` | tenant | yes (heartbeat) | no | no | no | tenant | Phase 15 |

## M. Reporting (Phase 14)

| Table | Scope | Mutable | Soft del | Version | Audit | RLS | Owner |
|-------|-------|---------|----------|---------|-------|-----|-------|
| `offline_conversion_uploads` | tenant | yes (status) | no | no | yes | tenant+role | Phase 14 |

## N. Webhooks (Phase 5+)

| Table | Scope | Mutable | Soft del | Version | Audit | RLS | Owner |
|-------|-------|---------|----------|---------|-------|-----|-------|
| `webhook_events` | tenant | yes (processed_at, result) | no | no | no | service-role only | Phase 05 |

## O. Integration credentials (Phase 12, 14)

| Table | Scope | Mutable | Soft del | Version | Audit | RLS | Owner |
|-------|-------|---------|----------|---------|-------|-----|-------|
| `integration_credentials` | tenant | yes | yes | yes | yes | tenant+role(admin) | Phase 12 |
| `integration_credential_access_log` | meta | **no** | no | no | no | tenant+role(admin) read-only | Phase 12 |

## P. Documents (v2.1, Phase 06b — light)

| Table | Scope | Mutable | Soft del | Version | Audit | RLS | Owner |
|-------|-------|---------|----------|---------|-------|-----|-------|
| `documents` | tenant | yes (metadata only) | yes | yes | yes | tenant + visibility-aware | Phase 06b |

Polymorphic parent (customer/job/quote/invoice). RLS check ensures access to parent grants access to document.

---

## Cross-cutting invariants (CI-enforced)

`tests/schema/contract.test.ts` asserts:

1. Every `tenant` scope table has `company_id UUID NOT NULL` (no exceptions)
2. Every `Mutable=yes` table that is also `Soft del=yes` has a `deleted_at timestamptz` column
3. Every `Version=yes` table has a `version int not null default 1` column
4. Every `Audit=yes` table has the `log_activity()` trigger attached (verified via `pg_trigger`)
5. Every `Mutable=no` table has an RLS policy that denies UPDATE and DELETE
6. Every `Soft del=yes` table's RLS SELECT policy includes `deleted_at IS NULL`
7. Every `tenant+role` table has the role check in its INSERT/UPDATE policies
8. Hard delete is impossible on any `Soft del=yes` table (verified by attempting `DELETE FROM` in test, expects rejection)

A red CI build on any of these is a regression and must not merge.

---

## Adding a new table

When adding a new table:

1. Decide its row in the matrix above (which columns apply)
2. Update this file FIRST, before editing schema.sql
3. Add the table to schema.sql with all required columns
4. Attach the audit trigger (if `Audit=yes`)
5. Add the RLS policy migration (if RLS row says anything other than `none`)
6. Run `tests/schema/contract.test.ts` — it should pass
7. The test file is the verification, not commentary
