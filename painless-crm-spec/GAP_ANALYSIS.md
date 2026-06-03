# GAP_ANALYSIS — iMVE (old) vs painless-crm (new)

**Author:** Laszlo + Claude Code
**Date:** 2026-06-03
**Method:** Visual audit of 8 iMVE screenshots (`references/views/*.png`) + the full iMVE Settings menu, compared against the live `painless-crm` route tree, schema (`supabase/migrations/`), and feature modules (`src/lib/`).
**Status:** Roadmap. No feature code written yet — this document is the plan. Phases 18+ are proposed; expand each ~1 month before starting (same doctrine as v0.2/v0.3 phases).

> **Evidence base:** old-system screenshots at `../references/views/` (`baord-view`, `calendar-view`, `client-view`, `finances-view`, `job-view`, `performance-view`, `storage-view`, `vehicle-view`). New-system routes under `../painless-crm/src/app`. Schema under `../painless-crm/supabase/migrations`.

---

## 0. Executive summary

The new CRM is **ahead of iMVE in back-end logic** (SLA engine, reporting attribution, dunning, affiliate commissions, automation engine, worker PWA offline sync, notification center, RLS multi-tenancy). iMVE is **ahead in two areas only**:

1. **The "everything is customisable" Settings catalog** — ~40 settings entries, most of them **document/PDF template designers** (quote, invoice, receipt, storage docs) plus field/status/job-sheet customisation.
2. **A handful of operational *views*** — dispatcher job board, general appointments calendar, consolidated visual analytics, a message inbox, and a community area.

**The most important finding for planning:** the majority of the visible "gaps" are **missing UI over schema that already exists** in our database. They are low-risk, no-new-infra builds. The genuinely infra-gated work is narrow (PDF rendering, inbound channel ingestion, file-storage bucket, audio capture).

| Schema status of the gaps | Examples | Build risk |
|---|---|---|
| **Schema already exists** — UI only | Company branding, admin/staff notes split, message inbox, dispatcher board, visual analytics, custom-invoice doc type | Low |
| **Small new schema** | Job tasks/checklist, job-status customisation, custom fields, lead-provider config | Medium |
| **Infra-gated** (blocked on a binding/provider) | PDF template *rendering*, inbound email/SMS ingestion, site-plan image upload, voice notes | Blocked until infra |

---

## Part A — Capability comparison (by area)

Legend: ✅ have · ⚠️ partial · ❌ missing · 🔒 infra-gated

### A1. Operational views

| iMVE capability (screenshot) | painless-crm today | Status | Schema exists? | Notes |
|---|---|---|---|---|
| **Job Board** — per-staff & per-vehicle daily swimlanes, follow-up calls, awaiting-payment badges (`baord-view`, `job-view`) | Status kanban (`jobs/kanban-board.tsx`) + rota + capacity calendar | ⚠️ | ✅ `job_assignments` (worker_id, vehicle_id, date, role, scheduled_start/end) | Dispatcher swimlane view is missing; all data exists. → **Phase 20** |
| **Calendar Overview** — month/week/day, category filter, Add Appointment, Staff Holiday (`calendar-view`) | Capacity calendar + rota | ⚠️ | partial — no generic `appointments`/`staff_holiday` table | Needs a small appointment + holiday model. → **Phase 22** |
| **Performance** — Jobs/Storage toggle, pie charts by type/source, big status breakdown, projected revenue, staff quote-conversion (`performance-view`) | `reports/*` (sources, financial, sla, team, storage) + dashboard tiles | ⚠️ | ✅ all data in `jobs`, `quotes`, `attributions` | Data exists; consolidated visual dashboard + projected revenue missing. → **Phase 21** |
| **Messages** — inbound/outbound conversation inbox | Notification center + bell | ❌ | ✅ `messages` (channel, direction, thread_id, in_reply_to, opened/replied) | Read-only inbox buildable now; live send/receive is 🔒. → **Phase 23** |
| **Community** | — | ❌ | ❌ | Out of scope for parity; lowest priority. → backlog |
| **Storage** — Containers/Customers tabs, **Import CSV**, **Plan Settings**, **Site Plan** image, container **Duplicate** (`storage-view`) | storage sites + containers + rentals | ⚠️ | ✅ `storage_containers`, `storage_sites` | CSV import + duplicate buildable now; site-plan image is 🔒 (bucket). → **Phase 24** |
| **Vehicle** — fleet cards with tax/MOT/insurance/service/payment/end-of-term + photos (`vehicle-view`) | vehicles + compliance cron | ✅ | ✅ | At parity (photos minor 🔒). |
| **Client/Workflow** — single rich job page: Comments, Voice Note, Task Management, Dispatch, Resources Required, Admin vs Staff notes, Previously Damaged photos, Custom Invoices (`client-view`) | Modular job detail (separate quote/survey/invoice/complaint/damage/timeline pages) | ⚠️ | ✅ `notes` (category admin/staff/customer_visible, mentions, pinned); ❌ tasks | Notes split + tasks → **Phase 19**. Voice note 🔒. |
| **Finances/Invoices** — outstanding banner, Deposit/Custom/Invoice type filter, Mark Paid (`finances-view`) | invoices + payments + allocation + dunning | ✅ | ✅ `invoices.type` includes `deposit`/`custom`/`final` | At parity; "custom invoice" already a first-class type. |

### A2. Where the new system is *ahead* of iMVE (do not regress)

SLA tracking + breach crons · reporting attribution & lead-quality scoring · invoice dunning cron · affiliate program with commission approve→pay · worker PWA with offline sync · notification center + @mentions + digests · automation engine (stage/event/dwell triggers) · RLS multi-tenant isolation · profit-by-job review queue · partner portal with HMAC magic-link.

---

## Part B — Settings catalog comparison

iMVE Settings menu mapped to our state. This is the **single biggest surface area gap**, and it is dominated by **document template designers**.

| iMVE Settings entry | painless-crm | Status | Schema exists? | Target phase |
|---|---|---|---|---|
| Account Information / Change Password | auth flows | ✅ | ✅ | — |
| **Company Information** | — | ❌ | ✅ `settings` (logo_url, brand_color, vat_number, ico_registration, business_hours, defaults) | **18** |
| **Site Customisation** (branding) | theme toggle only | ⚠️ | ✅ `settings.brand_color`, `logo_url` | **18** |
| **Job Fields Customisation** | — | ❌ | ❌ new | 25 |
| **Job Status Customisation** | fixed enum | ❌ | ❌ new (or `settings.feature_flags`) | 25 |
| Quote Pricing Templates | pricing engine + matrix + simulator | ✅ | ✅ | — |
| Detailed Costing | profit/costing | ⚠️ | ✅ | — |
| **Cubic Calculator Fields** | fixed cubic sheet | ⚠️ | partial | 25 |
| **Job Sheet Customisation** | fixed worker job sheet | ❌ | ❌ new | 25 |
| **Customer Acceptance** (terms) | — | ❌ | ✅ `documents` has `terms_accepted` type | 18/25 |
| **Company Sign-off Templates** | sign-off exists, no template config | ⚠️ | ✅ `customer_signoffs` | 25 |
| Email Templates / SMS Templates | template library | ✅ | ✅ | — |
| **Email Templates Builder** (visual) | code/merge-field editor | ⚠️ | ✅ `email_templates` | 25 |
| Email & SMS Automation | automation engine | ✅ | ✅ | — |
| **Email Configuration** (SMTP/sender) | — | ❌ | partial — needs config rows | 18 (config) / 🔒 send |
| **Quote / Deposit Receipt / Deposit Invoice Customisation** | HTML quote print only | ❌ | partial | **18** (config) + 🔒 render |
| **Invoice / Custom Invoice + Receipts Customisation** (4) | fixed invoice render | ❌ | partial | **18** (config) + 🔒 render |
| **Storage Invoice/Receipt/Custom (4) Customisation** | — | ❌ | partial | 18 (config) + 🔒 render |
| Rota Settings | rota | ✅ | ✅ | — |
| Staff Management | workers + users | ✅ | ✅ | — |
| **Vehicle Staff** (staff↔vehicle) | vehicle allocation on job | ⚠️ | ✅ `vehicle_assignments` | 20 |
| **Integrations** (hub) | per-feature webhooks | ⚠️ | partial | 26 |
| **Lead Provider Settings** | inbound webhooks, no UI | ⚠️ | partial | 26 |
| Import / Export Data | export module + audit | ⚠️ | ✅ export; ❌ generic import | 24 |
| **Account Statement** | — | ❌ | ✅ derivable from `invoices`/`payments` | 26 |
| **Training videos** | — | ❌ | ❌ | backlog |
| Refer a Friend | affiliates | ✅ | ✅ | — |

**Takeaway:** the document-template designer (quote/invoice/receipt/storage, ~12 of the ~40 entries) is one cohesive subsystem. Its **configuration storage and settings UI are buildable now**; only the **PDF rendering** is 🔒 on the Cloudflare Browser Rendering binding (already stubbed at `src/lib/integrations/pdf/test.ts`). Branding (Phase 18) is the foundation it sits on.

---

## Part C — Prioritised roadmap (Phases 18+)

Each phase below follows the spec's phase-doc shape (Goal / Gap closed / Schema / Infra / Deliverables / ADRs / Tests). Numbering continues from Phase 17. ADRs continue from ADR-026.

> **Sequencing rationale:** 18 first (branding is the foundation the document designer and customer-facing docs depend on). 19–21 next — all no-infra, high-visibility, fully testable. 22–24 are small no-infra adds. 25 (customisation engine) and 26 (integrations) are larger. The document-render and inbound-channel work stays 🔒 until infra lands.

### Phase 18 — Company Settings & Branding  ·  no-infra  ·  foundation  ·  ✅ BUILT (2026-06-03)
> **Shipped (no migration):** `settings/branding.ts` (pure `resolveBranding`/`isVersionConflict`), `schemas/settings.ts` (zod, hex + range validation), `queries/settings.ts` (`getCompanySettings`, `getBrandingByCompanyId`), `actions/settings.ts` (`updateCompanySettings`, version lock + company-name on `companies`), `settings/company` page + client form, branding wired into the quote-print header (logo + brand-colour rule), nav link, en/hu i18n, 21 tests. ADR-027 logged. `business_hours` editor deferred (jsonb; needs a structured UI). New columns (`company_address`, `email_from_name`/`reply_to`) deferred to a later migration if/when needed.
**Goal:** A Settings → Company area that edits the existing `settings` row; brand colour + logo + company identity flow into customer-facing surfaces.
**Gap closed:** Company Information, Site Customisation, Email Configuration (config only), foundation for all document customisation.
**Schema:** ✅ exists — `settings(company_id PK, logo_url, brand_color, business_hours jsonb, default_quote_validity_days, default_deposit_percent, default_currency, default_locale, default_timezone, feature_flags jsonb, vat_number, ico_registration, version)`. Likely add columns: `company_address jsonb`, `company_phone`, `company_email`, `registered_company_number`, `email_from_name`, `email_reply_to`.
**Infra:** none. (Actual email sending stays on Resend, already wired; this only stores from-name/reply-to.)
**Deliverables:**
1. `src/lib/queries/settings.ts` — `getCompanySettings()`.
2. `src/lib/actions/settings.ts` — `updateCompanySettings` (manager+; zod schema in `src/lib/schemas/settings.ts`; optimistic `version` lock; `revalidatePath`).
3. `src/app/dashboard/settings/company/page.tsx` + client form (matches `settings/templates` pattern).
4. Wire `brand_color` + `logo_url` + company identity into `app/quote/[token]/print/page.tsx` header (immediate visible payoff).
5. i18n: `en.json` + `hu.json` `companySettings` namespace.
**ADR:** ADR-027 — branding source of truth = `settings` row (not env), merged into doc headers at render.
**Tests:** `tests/settings/company.test.ts` — schema validation, version-conflict path, brand-merge helper.
**Est:** S.

### Phase 19 — Job Notes split & Task checklist  ·  no-infra  ·  ✅ BUILT (2026-06-03)
> **Shipped:** migration 45 `job_tasks` (table + RLS Pattern-1 inline + `set_updated_at` trigger). Tasks: `jobs/tasks.ts` (pure `completeness`/`nextSortOrder`), `schemas/job-task.ts`, `queries/job-tasks.ts`, `actions/job-tasks.ts` (add/toggle/delete), `tasks-panel`/`add-task-form`/`task-item` components, wired into job detail. Notes split (no schema change): `notes/group.ts` (pure `groupNotesByCategory`/`normaliseCategory`), `AddJobNoteSchema` + action gained optional `category` (backward-compatible with `is_customer_visible`), query returns `category`, panel renders Admin/Staff/Customer-visible timelines, add-form is now an audience select. i18n en (`jobTasks` + `notes` keys), hu mirrored. 917 tests. ADR-028 logged. Reorder + assignment UIs deferred (columns provisioned).
**Goal:** Bring the iMVE "Workflow" job page closer: separate Admin-notes vs Staff-notes timelines, plus a Task Management checklist on the job.
**Gap closed:** Admin Notes Timeline, Staff Notes Timeline, Task Management (`client-view`).
**Schema:** Notes ✅ exists — `notes(category in admin/staff/customer_visible, mentions uuid[], pinned, body_html)`. Tasks ❌ — new `job_tasks(id, company_id, job_id, title, done boolean, due_date, assigned_to_id, sort_order, created_by_id, …version, deleted_at)`. Register in RLS Pattern-1 tenant loop.
**Infra:** none.
**Deliverables:**
1. Migration `00000000000045_phase_19_job_tasks.sql` (table + RLS + `set_updated_at` trigger).
2. `queries/job-tasks.ts`, `actions/job-tasks.ts` (toggle/add/reorder/delete), schema in `src/lib/schemas/`.
3. Job-detail: split notes by `category` into two timelines; add Tasks card with checkbox toggles. (Reuse existing notes queries by category.)
4. i18n en+hu.
**ADR:** ADR-028 — job tasks are a lightweight checklist (no dependencies/assignment workflow) to match iMVE scope.
**Tests:** `tests/jobs/job-tasks.test.ts` (sort-order, toggle, completeness %), notes-by-category filter test.
**Est:** M.

### Phase 20 — Dispatcher Job Board  ·  no-infra  ·  ✅ BUILT (2026-06-03)
> **Shipped (no migration):** pure `lib/dispatch/board.ts` (`assembleBoard` staff/vehicle swimlanes + date window + empty-lane keep + inactive-lane backfill; `deriveBadges` stage→follow-up/awaiting-payment), `queries/dispatch-board.ts` (assignments-in-range joined to job/worker/vehicle + active lane lists), `app/dashboard/dispatch/page.tsx` (staff/vehicle toggle, 1–4 week range, prev/today/next, slot chips link to job), nav link (Operations, manager+), en/hu i18n `dispatch` ns. 925 tests. ADR-029 logged. Drag-to-reassign deferred (backlog).
**Goal:** The iMVE per-staff / per-vehicle daily swimlane board (`baord-view`, `job-view`) — read-only assembly, with the existing `job_assignments` as the source.
**Gap closed:** Job Board, Vehicle Staff visibility.
**Schema:** ✅ exists — `job_assignments(worker_id, vehicle_id, date, role, scheduled_start/end)`, `workers`, `vehicles`, `jobs`. No migration.
**Infra:** none.
**Deliverables:**
1. Pure assembler `src/lib/dispatch/board.ts` — group assignments → `{ laneType: 'staff'|'vehicle', laneId, date, slots[] }`; STAFF/VEHICLE toggle; week window. **Fully unit-testable** (no I/O).
2. `queries/dispatch-board.ts` — fetch a date range of assignments+jobs.
3. `src/app/dashboard/dispatch/page.tsx` — swimlane grid (Today/1-4 week range like iMVE), follow-up-call + awaiting-payment badges derived from job stage.
4. Nav link under Operations (manager+). i18n en+hu.
**ADR:** ADR-029 — board is read-only in v1 (drag-to-reassign deferred); assignment edits stay on the job page.
**Tests:** `tests/dispatch/board.test.ts` — grouping, empty lanes, multi-assignment days, week boundaries.
**Est:** M.

### Phase 21 — Visual Analytics dashboard  ·  no-infra  ·  ✅ BUILT (2026-06-03)
> **Shipped (no migration, no deps):** pure `lib/reports/analytics.ts` (`byType`/`byStatus`/`bySource`/`quoteConversionByStaff`/`projectedRevenue` + `WIN_PROBABILITY_BY_STAGE`), dependency-free `components/charts/{donut,bar}.tsx` (SVG stroke-dasharray + CSS bars, `CHART_COLORS`), `queries/reports.ts` `listAnalyticsJobs`, `app/dashboard/reports/analytics/{page,jobs-analytics,storage-analytics}.tsx` (Jobs/Storage toggle, month/quarter, reuses `buildStorageReport`), nav link (Customer care, manager+), en/hu i18n `analytics` ns. 933 tests. ADR-030 logged.
**Goal:** The iMVE Performance screen (`performance-view`) — consolidated charts on one page: jobs by category/status/type/source, quotation overview, revenue generated + **projected revenue**, staff quote-conversion.
**Gap closed:** Performance / visual analytics, projected revenue.
**Schema:** ✅ exists — `jobs`, `quotes`, `attributions`, `invoices`. Reuses existing `lib/reports/*`.
**Infra:** none. **No chart library is installed** — render with inline SVG (donut via stroke-dasharray) + CSS bars (consistent with current report pages, zero new deps).
**Deliverables:**
1. Pure aggregators `src/lib/reports/analytics.ts` — `byType`, `bySource`, `byStatus`, `quoteConversionByStaff`, `projectedRevenue` (sum of open-quote value × stage win-probability). Fully unit-testable.
2. Small presentational SVG components `src/components/charts/{donut,bar}.tsx` (no deps).
3. `src/app/dashboard/reports/analytics/page.tsx` (or extend `reports/`), Jobs/Storage toggle.
4. i18n en+hu.
**ADR:** ADR-030 — charts are dependency-free inline SVG; projected-revenue weights live in a documented constant map keyed by stage.
**Tests:** `tests/reports/analytics.test.ts` — each aggregator + projected-revenue weighting + empty-data.
**Est:** M.

### Phase 22 — Appointments calendar & Staff Holiday  ·  small schema
**Goal:** iMVE Calendar Overview (`calendar-view`) — month/week/day appointments with category filter + Add Appointment + Staff Holiday.
**Schema:** new `appointments(id, company_id, title, category, starts_at, ends_at, job_id?, customer_id?, assigned_to_id?, …)` + `staff_holidays(id, company_id, worker_id, start_date, end_date, kind, …)`. RLS Pattern-1.
**Infra:** none.
**Deliverables:** migration 46; queries+actions; calendar page with month/week/day + category filter; holiday surfaced on dispatcher board (Phase 20) and capacity.
**ADR:** ADR-031 — appointments are a thin overlay distinct from `job_assignments` (ops scheduling) and capacity (availability).
**Tests:** calendar windowing, overlap, holiday-blocks-availability.
**Est:** M.

### Phase 23 — Message inbox (read-only)  ·  no-infra (send/receive 🔒)
**Goal:** iMVE Messages nav — a conversation inbox over the existing `messages` table.
**Schema:** ✅ exists — `messages(channel, direction, thread_id, in_reply_to_message_id, subject, body, opened_at, replied_at, …)`.
**Infra:** read + thread view buildable now. **🔒 inbound ingestion** (provider webhooks) and **live send** (beyond existing Resend automation) stay gated.
**Deliverables:** `queries/messages.ts` (thread list + thread detail); `src/app/dashboard/messages/page.tsx` + thread view; link from job/customer. i18n en+hu.
**ADR:** ADR-032 — inbox v1 is read-only over stored messages; composing/inbound deferred to channel-infra phase.
**Tests:** thread grouping by `thread_id`, direction ordering.
**Est:** M.

### Phase 24 — Storage CSV import & container duplicate  ·  no-infra (site-plan 🔒)
**Goal:** iMVE storage Import CSV + container Duplicate (`storage-view`).
**Schema:** ✅ exists. **No CSV-import code exists today** (export-only) — add a small pure parser.
**Infra:** CSV + duplicate no-infra. **🔒 Site Plan image upload** (needs storage bucket).
**Deliverables:** pure `src/lib/storage/csv-import.ts` (parse + validate rows, no deps — hand-rolled CSV like the export module); `actions/storage-import.ts` (manager+, dedupe, dry-run preview); "Duplicate container" action; import UI. i18n en+hu.
**ADR:** ADR-033 — CSV import is validate-then-commit with a preview step; no silent row drops (log skipped rows).
**Tests:** `tests/storage/csv-import.test.ts` — quoting, bad rows, dedupe, duplicate-container clone.
**Est:** M.

### Phase 25 — Customisation engine (fields / statuses / job-sheet / sign-off / email builder)  ·  larger, mixed
**Goal:** The iMVE "Customisation" family beyond branding: Job Fields, Job Status, Cubic Calculator Fields, Job Sheet, Customer Acceptance, Company Sign-off Templates, visual Email Builder.
**Schema:** mostly new — a `custom_field_defs` / `custom_status_defs` model (or structured `settings.feature_flags`/jsonb config), plus template config rows.
**Infra:** none for config; the **document/PDF rendering of customised templates is 🔒**.
**Deliverables:** config schema + admin UIs; a config-driven renderer for job sheet / cubic fields; email builder (block-based, stored as JSON → existing merge-field engine).
**ADR:** ADR-034 — customisation is config-as-data (jsonb defs), validated by zod at read; no per-tenant code.
**Tests:** def validation, render-from-config, backward-compat with fixed defaults.
**Est:** L. **Expand before starting.**

### Phase 26 — Integrations hub, Lead Provider Settings, Account Statement  ·  mixed
**Goal:** iMVE Integrations + Lead Provider Settings UI + Account Statement.
**Schema:** lead-provider config rows; account statement derivable from `invoices`/`payments`.
**Infra:** statement + settings UI no-infra; specific provider connectors 🔒 per `INTEGRATION_CONTRACTS.md`.
**Deliverables:** integrations status hub (read of existing webhook config); lead-provider config UI feeding `jobs/intake.ts`; per-customer account statement page + CSV.
**ADR:** ADR-035 — lead-provider mapping is config-driven into the existing intake/attribution path.
**Est:** L.

### Backlog (lowest priority / out of parity scope)
Community/forum · Training videos · live drag-to-reassign on dispatcher board · vehicle photos.

---

## Part D — Infra-gated backlog (blocked, not forgotten)

| Capability | Blocked on | Already stubbed? |
|---|---|---|
| Document/PDF rendering of customised quote/invoice/receipt/storage templates | Cloudflare **Browser Rendering** binding (`env.BROWSER`) | ✅ `src/lib/integrations/pdf/test.ts` returns `partial` |
| Inbound email/SMS ingestion → Messages inbox | Provider inbound webhooks (Resend/Tamar) | partial — `messages` schema ready |
| Site-plan image upload, vehicle photos, voice notes, previously-damaged photos | Supabase **Storage bucket** + (audio: capture UI) | `documents` vault exists (25MB, allow-list) but not wired to these surfaces |
| Live send beyond automation (manual compose) | Channel send infra (Phase 13 gated parts) | automation `send_email` via Resend works |
| Go-live data migration from iMVE | WSL/CI build + Supabase apply + secrets | transform layer done (`src/lib/migration/`, Phase 17) |

---

## Part E — Recommended next action

Start with **Phase 18 (Company Settings & Branding)** — smallest, no-infra, and the foundation the entire document-customisation family depends on, with an immediate visible payoff (branded quote print). Then 19 → 20 → 21 as a no-infra, high-visibility, fully-tested run. Hold 25/26 and all 🔒 items until their infra (Browser Rendering binding, inbound webhooks, storage bucket) is provisioned via the CI/WSL path described in `phases/17-migration-golive.md`.

---

### Appendix — audit provenance
- Old-system screenshots: `references/views/{baord,calendar,client,finances,job,performance,storage,vehicle}-view.png`
- Old-system Settings menu: captured verbatim in the comparison request (≈40 entries).
- New-system routes: `painless-crm/src/app/dashboard/**`, `(worker)/**`, public `quote|feedback|partners|r`.
- New-system schema: `painless-crm/supabase/migrations/00000000000000…044`.
- Key schema facts that reclassified gaps from "missing" to "UI-only": `settings` (branding cols), `notes.category`, `messages` (thread/inbound cols), `job_assignments` (worker/vehicle/date/role).
