# Migration Mapping — iMVE → painless-crm

**Status:** skeleton
**Last updated:** spec v2
**Phase:** 17 (v0.3)

This document defines the field-by-field mapping from iMVE (the legacy system Painless currently uses) to painless-crm. Used by Phase 17's CSV importer and by the iMVE tab/read-only archive page.

> **Open decision OD-4:** Migration scope. Recommendation: 12 months active jobs migrated as live data + full historical archive imported as read-only reference. Final decision before Phase 17 implementation.

---

## 1. Overview

iMVE is a flat, legacy CRM with these top-level entities:

- **Customers** (~1750+ records)
- **Jobs** (overlaps with customers; iMVE doesn't strictly separate)
- **Quotes** (often inline with jobs)
- **Invoices** (mostly tracked in Xero, iMVE has summary status)
- **Notes / activity** (free-form, attached to job)

painless-crm normalizes this into the relational schema documented in `references/schema.sql`. The mapping is lossy in places — iMVE has free-text fields that don't decompose cleanly. Lossy fields go into `notes` (JSONB) on the migrated row.

---

## 2. Customer mapping

| iMVE field | painless-crm field | Notes |
|------------|--------------------|-------|
| Customer Name | `customers.primary_contact_name` (B2C) or `customers.business_name` (B2B) | Detect by presence of company indicator |
| Email | `customers.primary_email` | Lowercase, trim |
| Phone | `customers.primary_phone` | Normalize to E.164 (+44...) |
| Address line 1+2+town+postcode | `addresses` row + `customers.primary_address_id` | Geocode at import |
| Customer Type (B2B/B2C) | `customers.customer_type` | Direct mapping |
| Company name (B2B only) | `customers.business_name` | |
| Notes (free text) | `customers.notes` (text) | Preserve verbatim |
| Created date | `customers.created_at` | Preserve original |
| Last contact | (computed from activity log post-migration) | |

**Idempotency:** match on `(primary_email)` then `(primary_phone)` to detect existing customers across multiple iMVE entries (deduplication on import).

---

## 3. Job stage mapping (CRITICAL)

iMVE uses a flat 40+ status enum. painless-crm uses 13 canonical stages (per STATE_MACHINE.md) plus a `sub_status` field for higher resolution. The mapping:

| iMVE status | painless-crm stage | sub_status | decline_reason |
|-------------|---------------------|------------|----------------|
| New Enquiry | `lead` | (empty) | |
| Awaiting Callback | `contacted` | `awaiting_callback` | |
| Callback Done | `contacted` | (empty) | |
| Survey Booked | `survey_scheduled` | (empty) | |
| Survey Completed | `survey_scheduled` | `completed` | |
| Quote Sent | `quoted` | (empty) | |
| Quote Sent — Followup 1 | `quoted` | `followup_sent_1` | |
| Quote Sent — Followup 2 | `quoted` | `followup_sent_2` | |
| Awaiting Video | `quoted` | `awaiting_video` | |
| Quote Accepted | `accepted` | (empty) | |
| Awaiting Deposit | `accepted` | `awaiting_deposit` | |
| Job Confirmed | `confirmed` | (empty) | |
| Customer Requesting Reschedule | `confirmed` | `reschedule_requested` | |
| Job In Progress | `in_progress` | (empty) | |
| Job Done | `completed` | (empty) | |
| Job Done — Awaiting Payment | `invoiced` | (empty) | |
| Paid | `paid` | (empty) | |
| Lost — Too Expensive | `declined` | (empty) | `too_expensive` |
| Lost — Chose Competitor | `declined` | (empty) | `chose_competitor` |
| Lost — Timing | `declined` | (empty) | `timing` |
| Lost — Other | `declined` | (empty) | `other` |
| Lost — No Response | `dead` | (empty) | |
| Lost — Cancelled | `cancelled` | (empty) | |
| Lost — Customer Cancelled | `cancelled` | `customer_cancelled` | |
| Storage Active | `paid` (job stage) + `storage_rentals.status='active'` | (empty) | |
| Storage Terminated | `paid` (job stage) + `storage_rentals.status='terminated'` | (empty) | |

**TODO before Phase 17:** Get the full iMVE status list from Jay (~40+ values). Map every one. Any status not mapped triggers an import error — we don't silently default to a stage. Mapping must be reviewed and signed off by Jay.

---

## 4. Quote mapping

iMVE quotes are often free-form text in a notes field. The migrator extracts what it can but treats them as **historical reference** rather than active quotes:

| iMVE field | painless-crm field | Notes |
|------------|--------------------|-------|
| Quote text (free-form) | `quotes.notes` | Preserve verbatim |
| Quote total | `quotes.total_pence` | If numeric, convert; else null |
| Quote date | `quotes.created_at` | |
| Quote PDF (if attached) | upload to Supabase Storage, link in `quotes.pdf_url` | Manual review for missing PDFs |

Migrated quotes are flagged `quotes.legacy_imported = true`. Acceptance flow does not work on legacy quotes — the customer must be re-quoted in painless-crm if they want to accept.

---

## 5. Invoice / payment mapping

iMVE has invoice summaries; Xero has the actual invoice records. The migrator:

1. Imports the iMVE summary as `invoices.legacy_imported = true`
2. Attempts to match each iMVE invoice to a Xero invoice by `invoice_number` or `(customer + amount + date within 30 days)`
3. On match, fetches the canonical invoice from Xero and replaces the imported row's status
4. Unmatched invoices remain as `legacy_imported = true` with status `unknown_xero_state`

This is a v0.3 task and depends on Xero sync being operational (v0.2 Phase 12).

---

## 6. Notes / activity mapping

iMVE activity log is essentially free-text notes attached to jobs/customers. The migrator:

1. Each iMVE note becomes a row in `notes` table linked to the job
2. Author is preserved as text (not as `users.id` — iMVE users may not exist in painless-crm)
3. Date is preserved
4. Free-text content goes verbatim into `notes.body`
5. PII scrubbing rules from SECURITY_MODEL.md do NOT apply to notes content (it's already in our data) but DO apply if any of these notes ever surface in error logs

Notes are not migrated to `activity_log` — that table is reserved for system-generated audit events. Notes are user-authored content.

---

## 7. Photos / files

iMVE may have photo attachments. Migrator:

1. Downloads each attached file
2. Uploads to Supabase Storage with deterministic key `legacy/{customer_id}/{filename}`
3. Creates a `photos` row with `category = 'legacy'`
4. Preserves original filename in `photos.notes`

For very old jobs with hundreds of photos: the migrator runs in batches with rate limiting to avoid overloading either side.

---

## 8. Migration script architecture

```
scripts/migrate-imve/
├── extract.ts           -- Read iMVE export CSV(s)
├── transform/
│   ├── customers.ts
│   ├── jobs.ts
│   ├── status-mapping.ts -- The big mapping table from §3
│   ├── quotes.ts
│   └── notes.ts
├── load.ts              -- Insert into Supabase
├── validate.ts          -- Post-import sanity checks
└── rollback.ts          -- Remove all rows where legacy_imported=true
```

Run order:
1. `extract` — parse CSVs into JSONL
2. `validate-source` — assert iMVE export has all expected columns
3. `transform` — apply mappings, generate Supabase-shaped rows
4. `validate-transform` — assert no unmapped statuses, no null required fields
5. `load` — batch insert with `on conflict do nothing` for idempotency
6. `validate-load` — assert row counts match
7. `report` — generate migration report (success counts, mapping warnings, manual-review items)

Each step is idempotent. Rerunning the script with the same input is safe.

---

## 9. Read-only archive view

For data that doesn't justify full migration (e.g., 10-year-old completed jobs):

- Import as a separate table set: `archive_customers`, `archive_jobs`, etc.
- Read-only access via `/archive` page in admin UI
- Search by name/email/phone/postcode
- No editing, no transitions
- Marked clearly as "iMVE archive — not active CRM data"

This is the recommended scope for OD-4 (migration scope).

---

## 10. Cutover plan

1. **T-30 days:** Migration script runs against staging. Jay reviews 50 random customer/job records for accuracy.
2. **T-14 days:** Jay signs off the iMVE status mapping (§3 above).
3. **T-7 days:** Production migration run #1 — full export, dual-write enabled (CRM AND iMVE).
4. **T-3 days:** Final sync run. CRM is leading source of truth.
5. **T-0 (Go-live):** iMVE switched to read-only. CRM is the only system Jay's team uses for new work.
6. **T+30 days:** iMVE access revoked from sales team (admin-only access for historical lookup).
7. **T+90 days:** iMVE subscription cancelled.

---

## TODO before Phase 17

- [ ] Get full iMVE status list from Jay
- [ ] Get iMVE export format (CSV columns, encoding, etc.)
- [ ] Decide migration scope (OD-4)
- [ ] Map all 40+ statuses to (stage, sub_status, decline_reason) tuples
- [ ] Identify legacy data quality issues (duplicate customers, malformed addresses)
- [ ] Plan dual-write window and cutover date
