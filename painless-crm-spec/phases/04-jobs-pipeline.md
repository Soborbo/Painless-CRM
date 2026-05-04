# Phase 04 — Jobs & Pipeline

**Goal**: Build the job lifecycle UI: kanban board, job detail page, lead-to-job state transitions, AI duplicate detection. This is the daily-use UI for sales reps.

**Duration estimate**: 3 weeks
**Status**: Not started
**Prerequisite**: Phase 03 complete

---

## Why this phase

Sales reps live in this UI. Every minute they save here = more quotes per day = more revenue. Build for keyboard speed, not visual delight.

Lead and Job are the same entity (the `jobs` table). A "lead" is a job in `stage='lead'` or `stage='contacted'`. After `stage='accepted'` it's a real job. The CRM doesn't have a separate Leads section — the kanban shows everything from lead to paid.

---

## Deliverables

1. Kanban board with drag-and-drop between stages
2. Job list view (alternative to kanban) with filters and bulk actions
3. Job detail page (full record, all related data)
4. Quick-create job from customer card (Phase 3 link)
5. Job creation via webhook from painlessremovals calculator (covered in Phase 5; this phase prepares the webhook handler)
6. Stage transitions with validation rules and required fields
7. Job assignment to sales rep (round-robin + manual override)
8. AI duplicate detection on lead inbound (using Claude API)
9. Job tagging system (VIP, recurring, B2B, complex, etc.)
10. Bulk operations on filtered job list

---

## Pages

### `/dashboard/jobs` (default view: kanban)

Kanban board, columns by `stage`. Configurable: which columns show, in what order. Default for Painless:

```
[Lead] [Contacted] [Quoted] [Accepted] [Confirmed] [In Progress] [Completed] [Paid]
                                                                        |
[Declined / Dead / Cancelled (collapsed by default)]
```

Each card shows: Job number, customer name, move date (if set), value, source, assigned rep avatar. Color-coded edge for urgency (red = SLA breach, yellow = quoted >5 days no response, etc.).

Drag-and-drop between columns. Optimistic update + Server Action. If the transition needs data (e.g., moving to "Quoted" requires a quote exists), the modal opens.

Filters: source, assigned rep, date range, tags, customer type. URL-bound for shareable views.

Toggle to list view. List view shows more columns (customer, addresses from/to, assigned rep, last activity, days in stage).

### `/dashboard/jobs/[id]`

Job detail page. Tabs:

1. **Overview** — customer, addresses, properties, key dates, assigned rep, source, stage history
2. **Quote** — current quote, quote history, breakdown (Phase 5/6)
3. **Schedule** — assigned crew, vehicles, calendar slot (Phase 8)
4. **Photos** — uploaded images grouped by phase (before / during / after / damage) (Phase 10)
5. **Notes** — admin / staff threads with @mention (Phase 15 polishes this)
6. **Tasks** — todo items per job
7. **Sheets** — job sheet, cubic sheet, survey details (Phase 10)
8. **Money** — invoices, payments, deposit status (Phase 12)
9. **Activity** — full audit log

Header has stage selector (with validation), assignment selector, "New action" menu (send quote, log call, schedule survey, etc.).

### `/dashboard/jobs/new`

Quick-create form. Required: customer (search/select existing or create new inline), source, primary address. Default stage `lead`. Quote attached separately.

Most jobs are created via webhook (Phase 5), not manually. This page is for phone enquiries where the sales rep takes details live.

---

## Stage transitions (state machine)

> **Canonical source:** `STATE_MACHINE.md`. The transitions, required fields per transition, automation hooks, and storage-track branching all live there. This phase implements them. CI compliance test (`tests/state-machine.test.ts`) asserts no drift between STATE_MACHINE.md, the SQL `job_stage` enum, and the `validate_job_transition()` SQL function.

The 13 canonical stages: `lead`, `contacted`, `survey_scheduled`, `quoted`, `accepted`, `confirmed`, `in_progress`, `completed`, `invoiced`, `paid`, `declined`, `dead`, `cancelled`.

Implementation:

```ts
// src/lib/jobs/state-machine.ts
//
// Authoritative transitions table — must match STATE_MACHINE.md §2.
// CI test parses STATE_MACHINE.md and verifies this matches.

export const ALLOWED_TRANSITIONS: Record<JobStage, JobStage[]> = {
  lead:             ['contacted', 'declined', 'dead'],
  contacted:        ['survey_scheduled', 'quoted', 'declined', 'dead'],
  survey_scheduled: ['quoted', 'declined', 'dead'],
  quoted:           ['accepted', 'declined', 'dead'],
  accepted:         ['confirmed', 'cancelled'],
  confirmed:        ['in_progress', 'cancelled'],
  in_progress:      ['completed'],
  completed:        ['invoiced'],
  invoiced:         ['paid'],
  paid:             [],          // terminal — no forward transitions
  declined:         [],          // closed-lost — re-engagement creates a new job
  dead:             [],          // closed-lost — re-engagement creates a new job
  cancelled:        [],          // closed-lost — re-engagement creates a new job
};
```

Each transition:
- **Required fields** are defined in STATE_MACHINE.md §3 (e.g., `quoted` requires `quote_id`; `confirmed` requires `deposit_payment_id`; `completed` requires `customer_signoff_id`)
- **Automation triggers** are listed in STATE_MACHINE.md §5 (e.g., ENTER `paid` → upload offline conversion to Google Ads + Meta CAPI; ENTER `quoted` → send quote email + schedule follow-ups)
- **Audit entry** is recorded in `job_status_history` with `is_revert` flag for backward transitions

Server Action `transitionJobStage(jobId, targetStage, reason?)`:
1. Validates current stage allows target stage (via ALLOWED_TRANSITIONS)
2. Validates required fields are present (per STATE_MACHINE.md §3)
3. Calls `validate_job_transition(jobId, targetStage)` SQL function for DB-level invariants
4. Updates `jobs.stage`, writes to `job_status_history`, increments version
5. Enqueues automation triggers via `automation_queue` (processed by Phase 13)

### Backward transitions (reverts)

Some backward transitions are allowed (per STATE_MACHINE.md §2 "Can revert from?" column). E.g., `quoted → contacted` if a sales rep needs to re-do the quote. Reverts:

- Are restricted to `manager` role and above (sales reps cannot revert their own quotes once issued)
- Always log to `job_status_history` with `is_revert = true` and a mandatory `revert_reason`
- Trigger Sentry breadcrumb `state.revert` (high frequency = process problem worth investigating)

### Re-engagement of closed-lost jobs

A `declined`/`dead`/`cancelled` job is **terminal** — it cannot be moved back to active stages. Re-engagement (e.g., customer comes back 6 months later) creates a **new job** linked to the closed one via `parent_job_id`. The new job inherits the customer relationship but starts at `stage='lead'`.

This was a v1 ergonomic change — v1 allowed `declined → lead` re-engagement on the same row, which broke reporting (the same job appeared twice in funnel analytics).

---

## Job assignment

When a lead arrives via webhook:

1. **Round-robin (default)**: assign to next sales rep in rotation (`users` rows with role `sales` and `active=true`).
2. **Source-based override**: if source is in `lead_routing_rules` table (e.g., `B2B outreach (Rich)` → always Tom Mallett), apply override.
3. **Capacity-aware**: skip a rep who has >20 active leads OR is marked as out-of-office.

After Phase 8 (where rep performance metrics exist), upgrade to **signal-driven** assignment — rep with best conversion rate on this source/customer-type combo wins.

Manual reassignment from the job card (admin/manager).

---

## AI duplicate detection

Inbound leads are checked against existing customers + existing leads.

```ts
// src/lib/jobs/dedup.ts

import Anthropic from '@anthropic-ai/sdk';

export async function checkForDuplicates(incoming: {
  email?: string;
  phone?: string;
  full_name?: string;
  postcode?: string;
}, existingCandidates: Customer[]): Promise<{
  isDuplicate: boolean;
  matchedCustomerId?: string;
  confidence: number;
  reasoning: string;
}> {
  // Step 1: rule-based filter (already in Phase 3)
  // Exact email or phone match → return immediately, confidence 100

  // Step 2: AI check on remaining candidates
  if (existingCandidates.length === 0) {
    return { isDuplicate: false, confidence: 0, reasoning: 'No candidates' };
  }

  const claude = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const response = await claude.messages.create({
    model: 'claude-haiku-4-5-20251001',  // fast, cheap, sufficient
    max_tokens: 500,
    messages: [{
      role: 'user',
      content: `Compare this incoming customer:
${JSON.stringify(incoming, null, 2)}

To these existing customers:
${JSON.stringify(existingCandidates.map(c => ({
  id: c.id,
  name: c.full_name,
  email: c.primary_email,
  phone: c.primary_phone,
  postcode: c.postcode,
})), null, 2)}

Respond ONLY with JSON: { "match_id": "uuid or null", "confidence": 0-100, "reasoning": "one sentence" }
Match means same person (typo-tolerant on name, slight email variation, same household).`
    }],
  });

  const result = JSON.parse(response.content[0].text);
  return {
    isDuplicate: result.match_id !== null && result.confidence >= 70,
    matchedCustomerId: result.match_id,
    confidence: result.confidence,
    reasoning: result.reasoning,
  };
}
```

Cost: ~£0.001 per lead checked. At 50 leads/day = £15/year. Negligible.

Behaviour:
- **Confidence ≥ 90**: auto-link to existing customer, create new job under them, flag the rep
- **Confidence 70–89**: create new job, but flag with "Possible duplicate" badge, show comparison in UI, rep decides
- **Confidence <70**: create new job, no flag

Feature-flagged. Toggle off if Anthropic API has incident.

---

## Tags

`job_tags` table:
```sql
create table job_tags (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id),
  job_id uuid not null references jobs(id),
  tag text not null,  -- 'VIP', 'recurring', 'B2B', 'complex', 'piano', 'storage', etc.
  added_by_id uuid references users(id),
  added_at timestamptz not null default now()
);

create unique index job_tags_unique on job_tags(job_id, tag);
```

UI: tags shown on cards, filterable. Quick-add from job detail. Settings page lists all tags ever used in tenant + counts (for cleanup).

---

## SLA tracking (foundation for Phase 16)

Track time spent in each stage:

```sql
create table job_status_history (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id),
  job_id uuid not null references jobs(id),
  from_stage job_stage,
  to_stage job_stage not null,
  from_sub_status text,
  to_sub_status text,
  changed_by_id uuid references users(id),
  reason text,
  changed_at timestamptz not null default now()
);

create index job_status_history_job_idx on job_status_history(job_id, changed_at desc);
```

Trigger on `jobs` row update inserts history record.

Phase 16 dashboard queries this for "average time from lead to quote", "average time in 'quoted' stage", etc.

Per-stage SLA thresholds in `settings.feature_flags.sla` JSONB:
```json
{
  "lead": { "warn_hours": 1, "breach_hours": 4 },
  "contacted": { "warn_hours": 24, "breach_hours": 48 },
  "quoted": { "warn_days": 3, "breach_days": 7 }
}
```

UI shows yellow border on cards approaching warn, red on breach.

---

## Bulk operations

On filtered job list, multi-select checkbox per row + "Bulk actions" menu:
- Bulk reassign to rep
- Bulk add tag
- Bulk send email (template picker, requires Phase 13)
- Bulk export to CSV (always available)
- Bulk soft-delete (admin only, with confirmation modal showing affected count)

---

## Acceptance criteria

- [ ] Kanban renders 200 jobs in <500ms
- [ ] Drag job from "Quoted" to "Accepted" prompts for acceptance details and persists
- [ ] Trying to drag a job into "Confirmed" without a move date shows the missing-data prompt
- [ ] Quick-create from customer card pre-fills customer
- [ ] AI dedup with confidence ≥90 auto-links incoming lead to existing customer
- [ ] AI dedup with confidence 70–89 creates new but flags
- [ ] Tagging works (add, remove, filter by tag)
- [ ] SLA badges show yellow/red on overdue cards
- [ ] Bulk reassign 10 jobs to a different rep updates all in one transaction
- [ ] Round-robin assignment respects capacity rules
- [ ] Job detail page shows all 9 tabs (with placeholders for Phase 5+)
- [ ] Mobile-responsive kanban (collapsible columns, swipe navigation)

---

## Files created

```
src/
├── app/dashboard/jobs/
│   ├── page.tsx (kanban + list toggle)
│   ├── new/page.tsx
│   ├── [id]/
│   │   ├── page.tsx (job detail)
│   │   └── tabs/* (8 tab components, mostly placeholders for later phases)
├── lib/
│   ├── actions/jobs.ts (createJob, updateJob, transitionStage, assignToRep, bulkReassign)
│   ├── schemas/job.ts
│   ├── jobs/
│   │   ├── state-machine.ts
│   │   ├── routing.ts (round-robin assignment)
│   │   ├── dedup.ts (AI duplicate detection)
│   │   └── sla.ts (badge calculation)
└── components/domain/job/
    ├── KanbanBoard.tsx
    ├── KanbanCard.tsx
    ├── JobListTable.tsx
    ├── StageTransition.tsx
    ├── DuplicateFlag.tsx
    ├── TagChip.tsx
    └── SLABadge.tsx
```

---

## Out of scope (handled elsewhere in v0.1)

- Quote builder (Phase 6)
- Pricing engine integration (Phase 5)
- **SLA dashboard, job timeline view, Cmd+K search, requote one-click** (Phase 06b — v0.1)
- **Profit-by-job review form + dashboard** (Phase 06b — v0.1, ADR-019)
- **Manual phone call log** (Phase 06b — v0.1)
- **Internal vs customer-visible notes UI** (Phase 06b — v0.1)
- Capacity calendar / dynamic pricing (Phase 7 — v0.2)
- Resource scheduling (Phase 8 — v0.2)
- Photo / video uploads (Phase 10 — v0.2)
- Communications timeline content rendering (Phase 13 — v0.3, but timeline frame in Phase 06b)
