# Data Dictionary

**Status:** skeleton (expand alongside Phase 02 / 04 / 12 implementation)
**Last updated:** spec v2

This document explains every business field — what it stores, why it exists, who writes/reads it, and any gotchas. Use this when:

- Building a UI form and you're not sure what to label a field
- Writing reports and you need to confirm semantics
- Designing a query and you need to know whether to filter `deleted_at` or `status`

For complete column lists, types, and constraints, see `references/schema.sql`. This doc covers semantics, not types.

---

## Conventions

- **Money** is always `int` (pence). E.g., £1,234.56 = `123456`. Display layer divides.
- **Dates/times** are always `timestamptz` (UTC). Display layer converts to Europe/London.
- **Strings** are `text` (no varchar limits) unless explicitly enumerated.
- **UUIDs** for all primary and foreign keys.
- **Soft delete** via `deleted_at timestamptz` — null means active.
- **Optimistic concurrency** via `version int default 1`, increment on update.
- **Audit** via universal `log_activity()` trigger (see `references/audit-log.md`).

---

## A. Core entities

### `companies`

The tenant. Painless = the only row in v0.1.

| Field | Why | Notes |
|-------|-----|-------|
| `id` | Tenant identity | Painless = `'00000000-0000-0000-0000-000000000001'` |
| `name` | Display name | "Painless Removals" |
| `gmb_place_id` | Google review link | Used in Phase 11 universal review request |
| `vat_number` | UK VAT registration | Required for invoicing |
| `default_currency` | Always `GBP` for now | Multi-currency is post-v1 |
| `default_timezone` | Always `Europe/London` | Daylight saving handled by Postgres |

### `users`

Office staff (sales, admin, surveyors, accounts). Linked to Supabase Auth via `auth_id`.

| Field | Why | Notes |
|-------|-----|-------|
| `auth_id` | Supabase auth uid | Unique across all tenants |
| `company_id` | Which tenant | Set at invitation time |
| `role` | Permission level | One of 8 roles — see SECURITY_MODEL.md |
| `email` | Login + comms | Cannot change after creation (creates new user) |
| `name` | Display | First + last in single field |
| `last_active_at` | For "online" indicator | Phase 15 |

### `workers`

Loaders/drivers. Contractors, not employees (see ADR-006). Some workers also exist as `users` (for PWA login); link via `workers.user_id`.

| Field | Why | Notes |
|-------|-----|-------|
| `name`, `phone`, `email` | Contact | |
| `is_active` | Currently in pool? | False = no longer working with Painless |
| `pay_rate_pence_per_hour` | Default rate | Per-job overrides via `job_assignments.pay_rate_override` |
| `user_id` | Optional PWA login | Null if worker has no phone or doesn't use PWA |

### `settings`

Per-company configuration. One row per company (unique constraint).

| Field | Why | Notes |
|-------|-----|-------|
| `feature_flags` | JSONB switches | E.g., `{ "ai_dedup_enabled": true, "auto_followup_enabled": true }` |
| `allowed_sub_statuses` | JSONB array | List of valid sub-statuses for the company |
| `gps_clock_in_threshold_m` | PWA setting | Default 500, overridable |
| `quote_validity_days` | How long quotes hold | Default 30 |
| `email_signature_html` | Outbound email footer | |
| `gmb_place_id` | Mirror from `companies` | Easier read access |

---

## B. Customers

### `customers`

The customer entity (B2C individual or B2B business). One row per logical customer.

| Field | Why | Notes |
|-------|-----|-------|
| `customer_type` | B2C vs B2B | Discriminator: `individual` or `business` |
| `primary_contact_name` | B2C only | E.g., "Jane Smith" |
| `business_name` | B2B only | E.g., "ABC Property Ltd" |
| `primary_email` | Main contact email | Index-unique per company; lowercase |
| `primary_phone` | Main contact phone | Normalize to E.164 (`+44...`) at write time |
| `primary_address_id` | FK to addresses | Most-recent / preferred address |
| `lifetime_value_pence` | Computed | Materialized via `customer_lifetime_value()` RPC |
| `notes` | Free text | User-authored, not system-generated |
| `email_status` | `valid`, `bounced`, `unsubscribed` | Updated via Resend webhook (Phase 13) |

### `customer_contacts`

Multiple contacts per customer. B2B has many (estate agent, property manager, finance team); B2C usually has one.

| Field | Why | Notes |
|-------|-----|-------|
| `role` | Contact's role | Free text, e.g., "Property Manager", "Spouse", "PA" |
| `is_primary` | Default-to-contact | Bool; only one primary per customer |

### `customer_relationships`

Spouse-of, employee-of, referred-by relationships between customers.

| Field | Why | Notes |
|-------|-----|-------|
| `relationship_type` | Enum | `spouse_of`, `employee_of`, `referred_by`, `parent_of`, `recommended_by` |
| `from_customer_id`, `to_customer_id` | Direction matters | E.g., `referred_by` is one-way |
| `notes` | Free text | E.g., "Met at school gates" |

---

## C. Jobs

### `jobs`

The spine of the domain. Lead = `stage='lead'`. See STATE_MACHINE.md for full lifecycle.

| Field | Why | Notes |
|-------|-----|-------|
| `job_number` | Human-readable ID | Generated as `PR-{year}-{sequence}` |
| `stage` | Where in lifecycle | One of 13 canonical values per STATE_MACHINE.md |
| `sub_status` | Higher-resolution flag within stage | Free-form-ish; constrained by `settings.allowed_sub_statuses` |
| `decline_reason` | If stage = `declined` | Required for declined; null otherwise |
| `acquisition_source` | Where the lead came from | E.g., `painlessremovals_calculator`, `phone_inbound`, `referral_jay`, `gmb` |
| `affiliate_id` | Attribution | Set if attribution found in `attributions` table |
| `assigned_to_id` | Sales rep | Set on `contacted` |
| `surveyor_id` | Surveyor | Set on `survey_scheduled` |
| `enquiry_at`, `quoted_at`, `accepted_at`, `confirmed_at`, `completed_at`, `invoiced_at`, `paid_at` | Stage entry timestamps | Required by STATE_MACHINE.md §3 |
| `move_date` | The move | Locked at `accepted` |
| `quote_total_pence` | Final quote total | Updated when stage = `quoted` |
| `parent_job_id` | Re-engagement link | Null normally; set when this job replaces a `dead`/`cancelled` previous job |

### `job_addresses`

Origin / destination / via-points. A job can have multiple.

| Field | Why | Notes |
|-------|-----|-------|
| `role` | `from`, `to`, `via` | A job has 1 from, 1 to, optional via |
| `sequence` | Order for via-points | `from` = 0, `via` increments, `to` = highest |
| `notes` | Access info | E.g., "3rd floor, no lift, parking restrictions" |

### `job_assignments`

Worker × van × date — the rota line.

| Field | Why | Notes |
|-------|-----|-------|
| `worker_id`, `vehicle_id`, `job_id` | The triple | Composite unique on (worker, date) — one job per worker per day |
| `assigned_date` | Move day | For multi-day moves, multiple rows |
| `role` | `lead_loader`, `loader`, `driver` | Drives PWA permissions |
| `pay_rate_override_pence_per_hour` | Optional | Defaults to `workers.pay_rate_pence_per_hour` |

---

## D. Pricing

### `pricing_versions`

Immutable snapshots. Quote freeze depends on this.

| Field | Why | Notes |
|-------|-----|-------|
| `version_number` | Display | E.g., "v4.2" |
| `is_active` | One row per company | Boolean; managed by transition logic, not direct write |
| `published_at` | Set when activated | Used to revert if needed |
| `published_by_id` | Audit | |
| `config` | JSONB | The full margin matrix, hourly rates, distance bands, etc. — broadcast to KV |
| `migration_notes` | What changed | Markdown describing diff from previous version |

### `quotes`

A quote is a versioned snapshot. Once issued, doesn't change (quote freeze).

| Field | Why | Notes |
|-------|-----|-------|
| `pricing_version_id` | Snapshot taken at quote time | Frozen — KV changes don't affect issued quotes |
| `total_pence` | Frozen total | |
| `validity_until` | Calculated from `quote_validity_days` setting | After this, customer must request re-quote |
| `pdf_url` | Generated PDF location | Supabase Storage |
| `acceptance_url` | Public URL token | 256-bit random; expires with `validity_until` |
| `legacy_imported` | iMVE migration flag | Phase 17 |

---

## E. Money

### `invoices`, `invoice_lines`

Invoices and line items. v2: `invoice_lines` has `company_id` denormalized.

### `payments`

A payment received. v2: no `invoice_id` column — payments link to invoices via `payment_allocations`.

| Field | Why | Notes |
|-------|-----|-------|
| `amount_pence` | Gross amount | Always positive; refunds go through allocations |
| `method` | How paid | Enum |
| `xero_id` | Xero canonical ID | Unique; null if not yet synced |
| `source` | Origin | `xero_sync`, `gocardless_webhook`, `manual` |

### `payment_allocations` (v2 NEW)

Splits payments across invoices and tracks refunds/write-offs/credit notes.

See ADR-008 for rationale. See `INTEGRATION_CONTRACTS.md §3` for Xero interaction.

| Field | Why | Notes |
|-------|-----|-------|
| `payment_id` | Source payment | Required |
| `invoice_id` | Target invoice | Nullable for `overpayment_held` |
| `allocation_type` | Enum | `payment_to_invoice`, `refund`, `write_off`, `credit_note_applied`, `overpayment_held` |
| `amount_pence` | Allocation amount | Positive for normal, negative for refund/write-off |
| `reverses_allocation_id` | For corrections | E.g., if a payment was misallocated |

### `integration_credentials` (v2 NEW)

Encrypted storage of OAuth tokens for Xero, GoCardless, Google Ads, Meta, etc.

See ADR-009 and SECURITY_MODEL.md §5.

| Field | Why | Notes |
|-------|-----|-------|
| `provider` | Which integration | Enum |
| `access_token_encrypted`, `refresh_token_encrypted` | Encrypted at rest | pgcrypto with `INTEGRATION_ENCRYPTION_KEY` env |
| `expires_at` | When access token expires | For refresh scheduling |
| `external_account_id` | E.g., Xero tenant ID | Unique per (company, provider) |
| `status` | Lifecycle | `active`, `expired`, `revoked`, `pending` |
| `refresh_failure_count` | Trigger admin alerts | Threshold 3 |

---

## F. PWA / operations

### `time_entries`

Worker clock-in / clock-out / load-start / load-end / etc.

| Field | Why | Notes |
|-------|-----|-------|
| `client_event_id` | Idempotent offline submit | UUID generated client-side BEFORE going offline |
| `client_recorded_at` | When the worker pressed the button | Differs from `synced_at` for offline submissions |
| `synced_at` | When server received | |
| `gps_lat`, `gps_lng`, `gps_accuracy_m` | Location | Not always available |
| `flagged` | Distance from address > threshold | True = needs admin review |

### `vehicle_checks`, `photos`

Same `client_event_id` pattern. See Phase 9 schema.

---

## G. Communications

### `email_templates`, `sms_templates`, `whatsapp_templates`

Per-company customizable templates. WhatsApp templates require Meta pre-approval (1–2 week review).

### `messages`

Outbound sends. One row per send.

| Field | Why | Notes |
|-------|-----|-------|
| `channel` | `email`, `sms`, `whatsapp` | |
| `template_id` | If template-based | Null for ad-hoc |
| `status` | `queued`, `sent`, `delivered`, `opened`, `clicked`, `bounced`, `failed` | Updated via webhooks |
| `external_id` | Provider ID | Resend ID, Twilio SID, etc. |

---

## H. Sign-off & reviews

### `customer_signoffs`

End-of-job sign-off form. Internal satisfaction rating is here, used only for ops.

### `review_requests`

The universal review request (no NPS gating per ADR-010).

| Field | Why | Notes |
|-------|-----|-------|
| `sent_at` | When email/SMS went out | |
| `google_review_link_clicked_at` | Customer clicked review link | Stops follow-ups |
| `complaints_link_clicked_at` | Customer clicked complaints link | Stops follow-ups |
| `responded_at` | Either click | |
| `followup_count` | How many reminders sent | Max 2 (at +7d, +14d) |

### `complaints`, `damage_claims`

See Phase 11.

---

## I. Affiliates

### `affiliates`, `affiliate_codes`, `attributions`, `commission_records`

Affiliate program. v0.3 (Phase 16). Contracts and tax handling are in scope; payout automation is post-v1.

---

## J. Webhooks

### `webhook_events`

Idempotency record for inbound webhooks. See `references/webhook-pattern.md`.

| Field | Why | Notes |
|-------|-----|-------|
| `source` | Which sender | `painlessremovals`, `gocardless`, etc. |
| `event_id` | Sender-provided UUID | Unique per (source, event_id) |
| `processed_at` | When process function completed | |
| `result` | `success`, `duplicate`, `failed` | |
| `error_message` | If failed | PII-scrubbed |

---

## TODO (expand alongside implementation)

This is a skeleton. Each phase that introduces new tables should add its entities to this dictionary. The goal: a developer can find any field's purpose without reading source code.
