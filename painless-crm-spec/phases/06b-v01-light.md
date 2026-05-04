# Phase 06b — v0.1 Light Modules

**Status:** Full (v2.1 — new phase)
**Duration estimate:** 4 weeks
**Prerequisite:** Phase 04 (jobs pipeline), Phase 06 (quote builder)
**Version:** v0.1 (Painless internal go-live)
**Related:** ADR-016 (SLA), ADR-018 (documents), ADR-019 (profit-by-job), ADR-020 (search)

---

## Goal

Bundle the 9 high-value, low-effort features that **must be in v0.1** but didn't fit cleanly into a single phase. These aren't optional — Painless's competitive advantage on lead conversion depends on most of them.

The features here are deliberately scoped to be feasible in 4 weeks together. Each is "good enough for go-live" rather than "complete to spec" — the heavier versions land in v0.2/v0.3.

---

## 1. SLA timer dashboard (ADR-016)

**Why:** UK removals lead-to-first-response time correlates strongly with close rate. A 10-minute response wins 4× more than a 60-minute response. Painless currently has no visibility into this.

**Schema (already in `jobs` table v2.1):**
- `first_response_due_at timestamptz` — set on lead create: `enquiry_at + sla_minutes` (default 15 min, configurable per acquisition_source)
- `first_response_at timestamptz` — set when first contact is logged (call/email/whatsapp logged via Phase 06b §4)

**Logic:**
```ts
// On lead create (Phase 04 / Phase 05 webhook handler):
const slaMinutes = settings.sla_minutes_by_source[acquisition_source] ?? 15;
const due = new Date(enquiry_at.getTime() + slaMinutes * 60_000);
await admin.from('jobs').insert({
  ..., first_response_due_at: due,
});

// On first response (call logged, email sent, etc.):
if (job.first_response_at == null) {
  await updateJob(job.id, { first_response_at: now });
}
```

**Dashboard UI (`/dashboard/sla`):**
- "Overdue: 3 leads" red banner with one-click "View leads" button
- "Due in next 15 min: 2" yellow banner
- Table: lead, source, customer, time remaining (countdown), assigned rep
- Sortable by time remaining
- Real-time refresh via Supabase Realtime on `jobs` table

**Per-rep dashboard:** if you're a sales rep, you see only your own SLA queue. Manager sees everyone.

**Notifications:** push notification (Phase 15) when an overdue lead is assigned to you. v0.1 fallback: email digest at 9am with overdue leads.

**Acceptance:**
1. New lead created via webhook → `first_response_due_at` set correctly per source
2. Sales rep logs a call → `first_response_at` set, lead leaves SLA queue
3. SLA dashboard real-time updates without refresh
4. Overdue count matches a manual SQL query

---

## 2. Profit by job — manual cost input + dashboard (ADR-019)

**Why:** Painless currently doesn't know which jobs are profitable. Some long-distance moves with extra crew may actually lose money. Without per-job profit visibility, pricing decisions fly blind.

**Decision:** Manual input form in v0.1. Workflow: when a job moves to `completed` (or `paid`), a "Profit review" task appears for the admin. They open the form, enter actual costs, mark as reviewed. Dashboard then shows profit.

**Schema (already in `jobs` table v2.1):**
- `actual_crew_cost_pence int` — total paid to crew for this job
- `actual_van_cost_pence int` — fuel + mileage rate × distance + parking; admin enters total
- `passthrough_costs_pence int` — tolls, packing materials, congestion charges
- `profit_review_status text` — `pending` / `reviewed` / `finalized`
- `profit_review_completed_by_id uuid`
- `profit_review_completed_at timestamptz`

### 2a. Profit review form (`/jobs/[id]/profit-review`)

- Pre-filled defaults from estimates (estimated_hours × default_crew_rate, etc.) — admin overrides with actuals
- Crew breakdown: row per worker assigned, hours actual, hourly rate (defaults from `workers.pay_rate_pence_per_hour` or `job_assignments.pay_rate_override_pence_per_hour`), total
- Van costs: distance (from job + return trip), fuel rate per mile, parking notes
- Pass-through: line items (toll, packing materials, etc.)
- Auto-computed: revenue = sum of paid invoices for this job, profit = revenue − all costs, margin% = profit / revenue
- "Mark reviewed" button → sets `profit_review_status = 'reviewed'`, completed_by/at fields
- "Finalize" button (only visible to admin role) → sets `profit_review_status = 'finalized'` (no further edits)

Field-level validation (Zod) prevents negative costs (other than reversals) and percentages > 100.

### 2b. Profit dashboard (`/dashboard/profit`)

- Toggle: monthly / quarterly / custom range
- Headline numbers: revenue, total cost, gross profit, average margin%
- Table per job: customer, move date, revenue, cost, profit, margin%, sortable
- Filters: by sales rep, by acquisition source, by size class, by complications count
- Bottom rail: top 10 most profitable jobs, top 10 least profitable jobs (worst-margin warnings)
- Drill-in: click job → opens profit review form (read-only if finalized)

**Pending-review queue:** banner at top: "12 completed jobs awaiting profit review" with one-click filter.

**Acceptance:**
1. Job in `completed` stage shows up in profit-review pending queue within 1 hour
2. Filling the form correctly computes profit (manual SQL verification)
3. Dashboard sums match per-job sums to the penny
4. Filter by sales rep yields sensible per-rep margin
5. Finalized jobs cannot be edited (UI gates + DB trigger)

### 2c. Future automation (v0.2)

When the Worker PWA (Phase 09) is live, `time_entries` will give actual hours per worker per job, and the admin's pre-fills will be 90% correct on first load — they only review/confirm. v0.3 may auto-finalize for jobs where pre-fill matches estimates within 5%.

---

## 3. Global search (Cmd+K) (ADR-020)

**Why:** Painless office staff currently search across 5 systems for a single customer. Cmd+K everywhere = one less tab.

**Implementation:**
- shadcn `command` component (built on `cmdk`) in app root
- Trigger: `Cmd+K` (Mac) / `Ctrl+K` (Windows) / search icon in nav
- Query goes to a single Server Action `globalSearch(query: string)` that returns:
  - Customers: top 5 by name/email/phone fuzzy match
  - Jobs: top 5 by job_number, customer name, postcode
  - Quotes: top 3 by quote_number, customer name
  - Invoices: top 3 by invoice_number
  - Phone numbers: any customer/contact whose phone matches digits of query

**Postgres:**
- `pg_trgm` extension installed in Phase 02
- Trigram indexes on customers (name, email, phone), jobs (job_number, postcode), addresses (postcode + line1)
- All queries run with RLS — tenant scoping automatic

```sql
create extension if not exists pg_trgm;

create index customers_search_idx on customers
  using gin ((coalesce(primary_contact_name, '') || ' ' ||
              coalesce(business_name, '') || ' ' ||
              coalesce(primary_email, '') || ' ' ||
              coalesce(primary_phone, '')) gin_trgm_ops);

create index jobs_job_number_idx on jobs using gin (job_number gin_trgm_ops);
```

**Result UX:** grouped by entity type. Click → navigates to detail page. Recent searches stored in localStorage.

**Performance:** target <100ms p95 across 100k rows. pg_trgm + per-tenant scope makes this trivial at v0.1 scale (~5k jobs).

---

## 4. Manual phone call log (light Tamar)

**Why:** Tamar Telecom Partner API access is OD-1 (open). The full integration is v0.3. But sales reps need to log calls *now* — for SLA dashboard, for activity history, for call-back reminders.

**Schema (already in `phone_calls` table):** ensure these fields exist:
- `direction` — `inbound` / `outbound`
- `started_at`
- `duration_seconds`
- `outcome` — `connected_quote_sent` / `connected_no_answer` / `voicemail_left` / `wrong_number` / `not_interested` / `callback_requested`
- `next_action` — free text
- `next_action_due_at` — for reminders
- `customer_id`, `job_id` (FKs)
- `logged_by_id` (user)
- `notes` text

**UI:**
- "Log call" button in customer/job detail views and in global Cmd+K bar
- Quick form modal: who/when/duration/outcome/next action
- Auto-creates a calendar reminder if `next_action_due_at` is set
- The new call-log row's `started_at` triggers `first_response_at` on the related job (if not yet set)

This is the "right now" version. When Tamar Partner API is live (v0.3), inbound calls auto-create rows; manual logging continues to work.

---

## 5. Job timeline view

**Why:** Customer 360 currently shows separate tabs (notes, messages, status changes, payments). Putting them on one timeline = instant context for any rep picking up the job.

**Implementation:**
- New tab `/jobs/[id]/timeline`
- Server Action `getJobTimeline(jobId)` returns merged + sorted array from:
  - `job_status_history` (stage transitions)
  - `activity_log` (filtered to this job's entity_id)
  - `notes` (with `is_customer_visible` flag for icon differentiation)
  - `messages` (emails sent, SMS sent, WhatsApp where v0.3+)
  - `phone_calls` (logs with outcome)
  - `payments` (filtered to this job's invoices)
  - `documents` (added/removed)
- Sorted descending by occurred_at
- Each event has: icon, timestamp, actor, summary, details (expandable)

**UX detail:** Backend already has all the data — this is purely a UI compose page. ~3 days of work.

---

## 6. Requote one-click

**Why:** Returning customer 6 months later → currently a 10-min process to re-enter address, items, complications. Should be 30 seconds.

**Flow:**
- On a closed-lost (`declined` / `dead`) or `paid` job, button: "Generate new quote from this"
- Server Action `requoteJob(sourceJobId, overrides)`:
  1. Creates a new `jobs` row with `parent_job_id = sourceJobId`, stage = `lead`
  2. Copies addresses, complications, size_class, estimated_cubic_ft from source job
  3. Asks for: new move_date, refresh? (uses current pricing version)
  4. Creates a new quote via the standard quote flow (Phase 06)
- New job appears in lead funnel, linked to original via `parent_job_id` (visible in customer 360)

**Schema:** `jobs.parent_job_id` already added in v2.1.

---

## 7. Document vault (light) (ADR-018)

**Why:** Customers send T&Cs, parking permits, signed quotes via email. Right now these scatter across Gmail. Need one place per customer/job.

**Schema (already added in v2.1):** `documents` table with polymorphic parent (customer/job/quote/invoice).

**v0.1 scope (light):**
- Upload document on customer or job detail page (drag-and-drop)
- File goes to Supabase Storage at `{company_id}/documents/{document_id}/{filename}`
- Metadata row in `documents` with `document_type` selector
- List view: all documents per customer or per job, with type, upload date, downloader
- Public view: documents flagged `is_customer_visible = true` show on the customer's quote-acceptance page

**Out of scope (v0.2/v0.3):**
- E-sign workflow (use external for now if needed)
- OCR / AI document classification
- Document expiry alerts (insurance certificates, parking permits) — schema supports it via `expires_at`, UI in v0.2

---

## 8. Export pattern (CSV / Excel)

**Why:** Painless's accountant needs CSV exports of customers and invoices. Operations need filtered job exports.

**Implementation:**
- Generic `exportTable(resource, filters, format)` Server Action
- Resources supported in v0.1: `customers`, `jobs`, `quotes`, `invoices`, `payments`
- Formats: `csv` (default, fastest), `xlsx` (uses SheetJS — adds ~100KB to server bundle, isolated to this route)
- RLS-scoped — only rows the user can read are exported
- Streams large exports as multi-part response to avoid memory blow-up
- Audit-logged — every export records actor + filter + row count

**UI:** "Export" button on every list page. Modal with: format selector + (where applicable) date range + applied-filter summary.

**Rate limit:** 10 exports per user per hour (prevent rep-data-bulk-exfiltration per SECURITY_MODEL.md T4).

---

## 9. Internal vs customer-visible notes

**Why:** Mixing private operations notes (e.g., "customer was rude on the phone") with customer-facing notes is a lawsuit waiting to happen.

**Schema:** `notes.is_customer_visible boolean default false` (already added in v2.1).

**UI:**
- Note input has a toggle: "Internal" (default) / "Customer can see"
- Customer-visible notes appear on:
  - The customer's quote-acceptance page (read-only)
  - Email/WhatsApp/SMS to customer (if linked from a template)
- Internal notes are admin/sales/manager-only via RLS:
  ```sql
  create policy notes_read_internal on notes for select using (
    company_id = current_user_company_id()
    and (is_customer_visible = true or current_user_role() in ('admin','manager','sales','accounts','viewer'))
  );
  ```
- Default in the form is `false` (safer default — accidentally marking a private comment as visible would be worse than the reverse)

---

## 10. Owner daily home (`/`)

**Why:** Jay opens the CRM in the morning. He wants one screen with: how's it going?

**Layout (one screen, no scroll on desktop):**

```
┌────────────────────────────────────────────────────────────┐
│ Today, Wed 15 Apr                                          │
├──────────────────────┬──────────────────────┬──────────────┤
│ NEW LEADS (yesterday)│ QUOTES SENT          │ ACCEPTED     │
│       12             │       7              │       3      │
├──────────────────────┴──────────────────────┴──────────────┤
│ ⚠ SLA OVERDUE: 2 leads                       [View →]      │
├────────────────────────────────────────────────────────────┤
│ TODAY'S MOVES (4)                                          │
│  • 09:00 Smith family, BS9 → BA1    Crew: Jay, Pete, Tom   │
│  • 10:00 Brown move, BS5 → BS6      Crew: Tamara, Lara     │
│  • ...                                                     │
├────────────────────────────────────────────────────────────┤
│ CASH                                                       │
│  Outstanding: £8,420  •  Overdue: £1,200  [View →]         │
├────────────────────────────────────────────────────────────┤
│ PROFIT REVIEW QUEUE: 5 jobs awaiting               [View →]│
└────────────────────────────────────────────────────────────┘
```

Implementation: a single Server Component fetching all sections in parallel. ~1 day of UI work.

**Acceptance:**
1. Page renders <500ms p95
2. Data accurate to within 1 minute of writes (Supabase Realtime for SLA section)
3. Mobile responsive (Jay checks from phone too)

---

## Schema additions

All schema changes already landed in `references/schema.sql` v2.1. This phase only **uses** the schema, doesn't add to it. Specifically:

- `jobs.first_response_due_at`, `first_response_at` (SLA)
- `jobs.actual_crew_cost_pence`, `actual_van_cost_pence`, `passthrough_costs_pence`, `profit_review_*` (profit)
- `jobs.parent_job_id` (requote)
- `phone_calls` table (manual call log)
- `documents` table (vault)
- `notes.is_customer_visible` (private/visible split)

The `pg_trgm` extension and search indexes are added in Phase 02 (database schema migration).

## Pages

```
src/app/(office)/
├── page.tsx                          -- 10. Owner daily home
├── dashboard/
│   ├── sla/page.tsx                  -- 1. SLA dashboard
│   └── profit/page.tsx               -- 2b. Profit dashboard
├── jobs/[id]/
│   ├── timeline/page.tsx             -- 5. Job timeline
│   └── profit-review/page.tsx        -- 2a. Profit review form
└── _components/
    ├── command-bar.tsx               -- 3. Cmd+K
    └── export-button.tsx             -- 8. Export
```

## Acceptance criteria (phase-level)

1. Owner daily home renders all 5 sections correctly with real data
2. SLA dashboard updates in real-time as leads come in / responses are logged
3. Cmd+K returns relevant matches across all 5 entity types in <100ms
4. Profit review form computes correctly to the penny on 10 hand-crafted test jobs
5. Profit dashboard sums match the per-job sums
6. Job timeline shows events from all 7 sources, sorted correctly
7. Requote creates a linked new job, copies relevant fields, generates a new quote
8. Document upload + download works for all 4 parent types (customer/job/quote/invoice)
9. CSV export works on all 5 resources, with applied filters
10. Internal vs customer-visible notes are correctly gated by role

## Out of scope (deferred)

- Lead scoring (12 in original list) — v0.2 with AI
- Route logic / Maps API (17) — v0.3
- Cancellation recovery flow (28) — v0.2 automation engine
- UTM cleanliness checker (30) — Phase 14 v0.3 reporting
- Review recovery flow (34) — Phase 11 v0.2
- Fraud / spam filter beyond honeypot+rate-limit — v0.2

---

## Estimate

| Module | Days |
|--------|------|
| 1. SLA timer | 2 |
| 2. Profit by job (form + dashboard) | 4 |
| 3. Global search | 2 |
| 4. Manual call log | 2 |
| 5. Job timeline | 3 |
| 6. Requote one-click | 1 |
| 7. Document vault (light) | 3 |
| 8. Export pattern | 2 |
| 9. Internal/visible notes | 1 |
| 10. Owner daily home | 1 |
| **Total** | **21 days ≈ 4 weeks** |

Plus integration testing, polish, edge cases — realistic 4 weeks even with vibe-coding speed.
