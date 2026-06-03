# State Machine — Job Lifecycle

**Status:** canonical
**Last updated:** spec v2
**Owners:** Phase 04 (Jobs Pipeline), Phase 11 (Sign-off), Phase 14 (Reporting)

This document is the **single source of truth** for the job state machine. The SQL `job_stage` enum, the kanban UI, the pricing engine quote validity rules, the reporting pipeline, and the automation engine all derive from this document. If something disagrees with this file, this file wins and the disagreement is a bug.

A compliance test in CI (Phase 04) parses this file and the SQL enum and fails the build if they drift.

---

## 1. Stages (canonical)

13 stages, grouped into 4 buckets:

### Pre-quote (lead funnel)

| Stage | Display label | Description | Can revert from? |
|-------|---------------|-------------|------------------|
| `lead` | New enquiry | Form submitted, calculator-generated quote saved, or inbound call/email logged. No human touch yet. | (initial state) |
| `contacted` | Contacted | A sales rep has made first outreach (call attempted, email sent, WhatsApp sent). | `lead` |
| `survey_scheduled` | Survey scheduled | A video survey or in-person survey is on the calendar. | `contacted` |
| `quoted` | Quote sent | Quote PDF/email has been delivered to customer. `quote_id` and `quoted_at` are mandatory at this point. | `survey_scheduled`, `contacted` |

### Active (post-acceptance)

| Stage | Display label | Description | Can revert from? |
|-------|---------------|-------------|------------------|
| `accepted` | Accepted (awaiting deposit) | Customer has accepted the quote (e-signature or written confirmation). Deposit invoice has been issued. | `quoted` |
| `confirmed` | Confirmed | Deposit payment received. Job is locked into the calendar. Vehicles and crew can be assigned. | `accepted` |
| `in_progress` | In progress | Crew has clocked in at origin. For multi-day moves this stage spans the entire job window. | `confirmed` |
| `completed` | Completed | All physical work done. Customer signed the end-of-job form. Awaiting final invoice. | `in_progress` |
| `invoiced` | Final invoice issued | Final invoice generated and sent (Xero or manual). Awaiting final payment. | `completed` |

### Closed-won

| Stage | Display label | Description |
|-------|---------------|-------------|
| `paid` | Paid | All payments cleared. Job is archived from active dashboards. |

### Closed-lost

| Stage | Display label | Description |
|-------|---------------|-------------|
| `declined` | Declined | Customer explicitly rejected the quote. Reason captured in `decline_reason`. |
| `dead` | Dead enquiry | No response after N follow-ups (configurable per company). Different from declined — we don't know why. |
| `cancelled` | Cancelled | Customer cancelled after `accepted` or `confirmed`. Deposit refund handling is per-case. |

---

## 2. Transition rules

Allowed forward transitions (ASCII, source → target):

```
lead ──────────────────────► contacted
                                │
                                ├──► survey_scheduled ──► quoted
                                │                          │
                                └──► quoted ◄──────────────┘
                                       │
                                       ├──► accepted ──► confirmed ──► in_progress ──► completed ──► invoiced ──► paid
                                       │
                                       └──► declined / dead

(any stage from lead through quoted) ──► dead       (silent attrition)
(any stage from accepted onward)      ──► cancelled
```

### Forbidden transitions

- Cannot go directly from `lead` to `accepted` (must pass through `quoted`). Enforces a quote always exists before acceptance — required for legal/audit reasons.
- Cannot go from `paid` to anything else. Use a credit note + new job for refund scenarios.
- Cannot go from `cancelled` to active stages. Re-engagement creates a new job linked via `customer_relationships` or job-level `parent_job_id`.

### Backward transitions (allowed, audited)

The "Can revert from?" column above lists the only allowed backward transition for each stage. Any other backward movement is forbidden. Backward transitions:
- Are always logged in `job_status_history` with `is_revert = true` and a mandatory `revert_reason`.
- Are restricted to `manager` role and above (sales reps cannot revert their own quotes once issued).
- Trigger Sentry breadcrumb `state.revert` for monitoring (high frequency = process problem).

---

## 3. Required fields per transition

A transition INTO a stage may require certain fields. The transition is rejected (HTTP 400 with field-level error) if the required field is null. These rules are enforced in `lib/jobs/transition.ts` (server-side) and mirrored in the UI (`components/jobs/StageMover.tsx`).

> **v2.1 note:** all stage-entry timestamps (`contacted_at`, `survey_at`, `quoted_at`, `accepted_at`, `confirmed_at`, `in_progress_at`, `completed_at`, `invoiced_at`, `paid_at`, `declined_at`, `dead_at`, `cancelled_at`) live on the `jobs` table itself. They are set by the transition function in addition to the existing event row in `job_status_history`. This duplication is intentional — the timestamps on `jobs` are denormalized for fast reporting (funnel analysis, time-in-stage); `job_status_history` holds the full ordered transition log.

| Target stage | Required fields | Notes |
|--------------|-----------------|-------|
| `lead` | `customer_id`, `enquiry_at`, `acquisition_source` | Set automatically by webhooks and lead-create flows. Also sets `first_response_due_at`. |
| `contacted` | `assigned_to_id` (sales rep). Sets `contacted_at`. | A human owns the lead from this point. |
| `survey_scheduled` | `survey_at` (timestamptz), `surveyor_id`. Sets `survey_at` on jobs. | Calendar event auto-created. |
| `quoted` | `quote_id` (FK), `quote_total_pence`. Sets `quoted_at`. | Quote must be in `issued` status. |
| `accepted` | `quote_acceptance_id` (FK), `move_date`. Sets `accepted_at`. | move_date is locked at this point. |
| `confirmed` | `deposit_payment_id` (FK). Sets `confirmed_at`. | Triggers calendar lock and capacity allocation. |
| `in_progress` | First `time_entries` row with `clock_in_at`. Sets `in_progress_at`. | Auto-set by worker PWA clock-in (v0.2). |
| `completed` | `customer_signoff_id` (FK). Sets `completed_at` and `profit_review_status='pending'` (ADR-019). | End-of-job form signed. |
| `invoiced` | `final_invoice_id` (FK). Sets `invoiced_at`. | Xero sync may be async — `invoiced_at` is when we issued, not when Xero confirmed. |
| `paid` | All open invoices for this job have status = `paid`. Sets `paid_at`. | Verified by RPC `is_job_fully_paid(job_id)`. |
| `declined` | `decline_reason`. Sets `declined_at`. | Categorical: too_expensive, chose_competitor, timing, scope_changed, other. |
| `dead` | (no required field, sets `dead_at`) | Set by automation when N days pass without engagement. |
| `cancelled` | `cancellation_reason`, `deposit_refund_decision`. Sets `cancelled_at`. | Refund decision: refund_full, refund_partial, retain_per_terms. |

---

## 4. Storage track (parallel branch)

For jobs that include storage (and especially recurring storage rentals), there is a **parallel** lifecycle that branches at `accepted`:

```
job.stage = 'accepted' (with storage product)
   │
   └──► storage_rentals row created
            │
            ├──► status = 'pending_collection'   (job is in_progress)
            ├──► status = 'active'               (storage is in container, recurring billing on)
            ├──► status = 'pending_delivery'     (customer requesting delivery)
            └──► status = 'terminated'           (rental ended, container returned)
```

The job stage and storage rental status are independent. A job can be `paid` (initial move invoice settled) while its storage rental is still `active` (recurring monthly billing).

---

## 5. Automation triggers per stage

These are the canonical hooks. The automation engine (Phase 13) attaches behaviors to stage entry/exit events. Defaults:

| Trigger event | Default behavior | Configurable |
|---------------|------------------|--------------|
| ENTER `lead` | Round-robin assign to sales rep based on source rules | yes |
| ENTER `lead` | Run AI duplicate detection (Claude Haiku) | yes |
| ENTER `lead` | Set `first_response_due_at = enquiry_at + sla_minutes_for_source` (ADR-016) | yes (per source) |
| FIRST CONTACT logged (call/email/whatsapp) | Set `first_response_at = now()` if not yet set; SLA dashboard updates | no |
| SLA OVERDUE (`first_response_due_at < now()` and `first_response_at` null) | Push notification to assigned rep + manager (Phase 15); v0.1 fallback: 9am email digest | yes |
| ENTER `quoted` | Send quote email with PDF | yes (template) |
| ENTER `quoted` | Schedule follow-up reminder at +2 days, +5 days, +10 days | yes (cadence) |
| ENTER `accepted` | Issue deposit invoice | yes (auto vs manual) |
| ENTER `confirmed` | Lock calendar slot, decrement capacity counter | no |
| ENTER `confirmed` | Send confirmation email + WhatsApp | yes (template) |
| ENTER `in_progress` | Push notification to operations admin | yes |
| ENTER `completed` | Trigger end-of-job form to customer (SMS + email) | yes (channel) |
| ENTER `completed` | Set `profit_review_status = 'pending'` and surface in admin queue (ADR-019) | no |
| ENTER `invoiced` | Send invoice via Xero email + CRM email | yes |
| ENTER `paid` | Send review request (universal — see Phase 11) + thank-you email | yes |
| ENTER `paid` | Upload offline conversion to Google Ads + Meta CAPI | yes |
| ENTER `declined` | Schedule "win-back" email at +30 days | yes |
| ENTER `dead` | No automation by default | yes |

### 5a. Non-stage automation events (ADR-024)

Not every automation hook is a stage transition. The engine also fires on these **events**, enqueued
best-effort from the relevant mutation (a failure never breaks the mutation). They flow through the same
`automation_queue` + per-minute cron as stage rules; rules subscribe via `automation_rules.trigger_event`.

| Event (`trigger_event`) | Enqueued from | Typical use |
|---|---|---|
| `job.created` | job-create path (`lib/actions/jobs.ts`) | Welcome email on new enquiry |
| `invoice.created` | `lib/actions/invoices.ts` `createInvoice` (`action_config`/payload carries `kind`) | Deposit / final invoice email |
| `payment.recorded` | `lib/actions/payments.ts` `recordPayment` (payload carries `kind: deposit\|final`) | Deposit / move receipt email |

The quote service line (`removal` vs `waste_clearance`) is matched via `trigger_filters.service_type`
(ADR-025), so ENTER `quoted` sends the right quote template.

### 5b. Dwell-guarded follow-ups (ADR-024)

The ENTER `quoted` follow-up cadence (above) is implemented as delayed `job.stage_changed` rules carrying
`action_config.requires_stage: 'quoted'`. When a queued follow-up comes due, the cron re-checks the job's
**current** stage: if it is no longer `quoted` (the customer replied, accepted, or the job was declined),
the row is finished as `skipped` / `superseded` and no email is sent. This auto-cancels the chain with no
separate cancellation path. `requires_stage` is the general contract for any "send unless superseded" rule.

---

## 6. Sub-status field

Every job has an optional `sub_status TEXT` field, free-form-ish but constrained per company in `settings.allowed_sub_statuses`. This is the third axis after `stage` and `decline_reason`. Examples:

- `quoted` + sub_status `awaiting_video` → quote sent but customer hasn't done the survey video yet
- `quoted` + sub_status `followup_sent_1` → first follow-up sent, awaiting reply
- `confirmed` + sub_status `crew_assigned` → operations have done resource allocation
- `in_progress` + sub_status `between_days` → multi-day move, day 1 done, day 2 pending

Sub-statuses are **display-only** — they don't change automation. They exist to give the kanban a tighter signal of where each card is "really" at within a stage.

The full list is configurable per tenant. Painless ships with ~25 sub-statuses (mirroring iMVE's high-resolution status detail).

---

## 7. Compliance test

`tests/state-machine.test.ts` (Phase 04) parses this file's `## 1. Stages` table and the SQL `job_stage` enum, and asserts:

1. Every stage in this doc exists in the SQL enum
2. Every stage in the SQL enum exists in this doc
3. Every required field listed in `## 3` exists in the `jobs` table or its FK chain
4. Every transition rule in `## 2` is enforced by the `validate_job_transition()` SQL function
5. Every automation trigger in `## 5` has a corresponding row in the seeded `automation_rules` table

CI fails the build if any assertion fails. Drift between this doc and reality is **not** allowed to slip through.

---

## 8. Migration mapping (iMVE → painless-crm)

iMVE uses a flat 40+ status enum. The mapping is in `MIGRATION_MAPPING.md` §3. Examples:

| iMVE status | painless-crm stage | sub_status |
|-------------|---------------------|------------|
| New Enquiry | lead | (empty) |
| Awaiting Callback | contacted | awaiting_callback |
| Quote Sent | quoted | (empty) |
| Quote Sent - Followup 1 | quoted | followup_sent_1 |
| Awaiting Video | quoted | awaiting_video |
| Job Confirmed | confirmed | (empty) |
| Job Done - Awaiting Payment | invoiced | (empty) |
| Lost - Too Expensive | declined | (empty) + decline_reason='too_expensive' |
| Lost - No Response | dead | (empty) |

Some iMVE statuses are **lossy** in conversion (e.g., "Customer Requesting Reschedule" gets mapped to confirmed + sub_status='reschedule_requested'). The full mapping is reviewed by Jay before migration.
