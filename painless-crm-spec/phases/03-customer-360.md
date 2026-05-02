# Phase 03 — Customer 360

**Goal**: Customer is the second-most important entity (after Job). Build the consolidated customer card UI: B2C and B2B unified, all jobs, all storage, all invoices, all communications, all relationships in one screen.

**Duration estimate**: 3 weeks
**Status**: Not started
**Prerequisite**: Phase 02 complete

---

## Why this phase

90% of storage customers are also moving customers. Recurring customers are the most valuable. The current iMVE shows fragments — Clients tab + Jobs tab + Invoices tab — never the full picture. The customer 360 view is a Painless USP and a sales enabler: the rep on the call sees everything, doesn't ask repeat questions, makes informed offers.

This phase delivers UI on top of the schema from Phase 2. No new tables; pure UI + Server Actions.

---

## Deliverables

1. Customer list page with search, filters, sort
2. Customer card page (the 360 view)
3. Create customer flow (B2C and B2B variants)
4. Edit customer with optimistic concurrency
5. Customer relationships UI (link to spouse, employer, referrer)
6. Customer contacts UI (multiple contacts per business customer)
7. LTV + job count + last contact computed and displayed
8. Marketing consent capture and audit
9. Customer merge tool (admin only) for duplicates
10. CSV export of customer list (filtered)

---

## Pages

### `/dashboard/customers`

Customer list. Sortable, filterable, searchable.

Columns: Name | Type (B2C/B2B icon) | Phone | Email | Postcode | LTV | Last Job | Status (active/dormant/at-risk).

Filters:
- Type: All / Individual / Business
- Status: Active (job in last 90 days) / Dormant (90–365) / At Risk (>365 or recurring storage with late payment)
- Source: All sources from settings (Google, B2B outreach, Affiliate, etc.)
- Affiliate: dropdown of affiliates
- Has storage: yes/no
- Created date range

Search: fuzzy match on name, email, phone, postcode (using `pg_trgm` index from Phase 2).

Sort: Most recent | LTV high to low | Last contact | Name A-Z.

Pagination: 50 per page, server-rendered. Infinite scroll on mobile.

Bulk actions (admin/manager): export CSV, bulk-tag (add/remove tag), bulk-soft-delete.

### `/dashboard/customers/new`

Two-step modal:
1. Type select: Individual or Business
2. Form (different fields per type)

Address autocomplete via UK postcode lookup (use Postcoder or ideal-postcodes — same provider as painlessremovals calculator if possible).

Duplicate check on submit: if email/phone/postcode matches existing customer, show "Possible duplicate found" with link to existing customer + option to "Use this customer instead" or "Create anyway".

### `/dashboard/customers/[id]`

The main customer 360 card. Layout:

```
┌───────────────────────────────────────────────────────────────────┐
│ [Avatar] Name (B2C) or Company Name (B2B)         [Edit] [⋯ menu] │
│ Type badge | Status badge | Tags                                  │
│ ─────────────────────────────────────────────────────────────────│
│ ┌────────────────────────┬──────────────────────────────────────┐ │
│ │ Quick Stats            │ Tabs:                                │ │
│ │   LTV: £4,820          │ [Jobs (8)] [Storage (1)] [Invoices  │ │
│ │   Jobs: 8 (3 active)   │  (12)] [Communications] [Notes]     │ │
│ │   First seen: 2024-Mar │ [Relationships] [Activity]           │ │
│ │   Last contact: 5d ago │                                      │ │
│ │                        │ ─── tab content ───                  │ │
│ │ Contact                 │                                      │ │
│ │   📞 +44 7xxx          │                                      │ │
│ │   ✉  jonny@…           │                                      │ │
│ │   📍 Bristol BS6 6DW   │                                      │ │
│ │                        │                                      │ │
│ │ Source                 │                                      │ │
│ │   B2B Outreach (Rich)  │                                      │ │
│ │                        │                                      │ │
│ │ Marketing Consent      │                                      │ │
│ │   ✓ Email ✗ SMS        │                                      │ │
│ └────────────────────────┴──────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────┘
```

#### Jobs tab

List of all jobs (any stage, any time), sortable by date. Each card shows: Job number, stage badge, move date, value, source. Click → job detail page. Inline action: "New job" pre-fills customer.

#### Storage tab

Active storage rentals (container ID, site, monthly rate, started, last paid). Past rentals (terminated, dates).

#### Invoices tab

All invoices. Status badges (draft/sent/paid/overdue). Click → invoice detail. Aggregate at top: Total invoiced / Total paid / Outstanding.

#### Communications tab

Unified timeline: emails sent, SMS sent, WhatsApp sent, phone calls (from Tamar email parsing in Phase 13). Each entry: timestamp, channel icon, direction (in/out), preview. Click → full content.

In Phase 3, only emails (from `messages` table) are populated — Phase 13 fills in SMS, WhatsApp, calls. Build the UI with the placeholders.

#### Notes tab

Free-form notes per customer (separate from job notes). Markdown support. @mention notifies the user.

#### Relationships tab

Cards showing related customers. "[Wife of] Jane Hall" / "[Employs] 4 people at Relish" etc. "Add relationship" opens picker.

#### Activity tab

Audit log entries for this customer + their jobs + their invoices. Filter by action type. This is the ground truth: who did what when.

---

## Server Actions

```ts
// src/lib/actions/customers.ts

'use server';

import { z } from 'zod';
import { requireRole } from '@/lib/auth/require-role';
import { createServerClient } from '@/lib/supabase/server';
import { customerSchema } from '@/lib/schemas/customer';

export async function createCustomer(input: z.infer<typeof customerSchema>) {
  const user = await requireRole(['admin', 'manager', 'sales']);
  const validated = customerSchema.parse(input);
  const supabase = await createServerClient();

  // Dedup check
  const { data: dupes } = await supabase.rpc('find_duplicate_candidates', {
    p_email: validated.primary_email ?? null,
    p_phone: validated.primary_phone ?? null,
  });
  if (dupes && dupes.length > 0 && !validated.force_create) {
    return { ok: false, duplicates: dupes };
  }

  const { data, error } = await supabase
    .from('customers')
    .insert({
      ...validated,
      company_id: user.company_id,
      created_by_id: user.id,
      updated_by_id: user.id,
    })
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, customer: data };
}

export async function updateCustomer(id: string, version: number, patch: Partial<z.infer<typeof customerSchema>>) {
  // ... optimistic concurrency: WHERE id = ? AND version = ?
  // Returns 409 if version mismatch
}

export async function softDeleteCustomer(id: string, version: number) {
  // requireRole(['admin', 'manager'])
  // Set deleted_at, increment version
}

export async function mergeCustomers(survivor_id: string, victim_id: string) {
  // requireRole(['admin'])
  // Move all jobs, invoices, storage_rentals from victim to survivor
  // Soft-delete victim
  // Audit log entry: 'customer_merged' with both IDs
}
```

---

## LTV computation

Two options:

**A. Computed view (simpler, slower at scale)**
```sql
create view customer_ltv as
select
  c.id as customer_id,
  c.company_id,
  coalesce(sum(p.amount_pence), 0) as ltv_pence,
  count(distinct j.id) as job_count,
  max(j.created_at) as last_job_at
from customers c
left join jobs j on j.customer_id = c.id and j.deleted_at is null
left join invoices i on i.job_id = j.id and i.status = 'paid' and i.deleted_at is null
left join payments p on p.invoice_id = i.id
where c.deleted_at is null
group by c.id, c.company_id;
```

**B. Materialized view + refresh on schedule (faster, slightly stale)**
```sql
create materialized view customer_ltv_mv as
  -- same query as above
;
create index on customer_ltv_mv(customer_id);
refresh materialized view concurrently customer_ltv_mv;
-- Cron: refresh every hour
```

Start with **A** (view). If list query slows below 200ms at 5K customers, switch to B. Don't preempt.

---

## Marketing consent (GDPR)

When a customer is created via webhook (from painlessremovals calculator), the consent state is captured at source. The `customers.marketing_consent` boolean is set, `customers.marketing_consent_at` is set, and a row in `customer_consents` records the source URL, IP, user agent.

UI shows:
- Email consent: ✓/✗
- SMS consent: ✓/✗ (default ✗)
- WhatsApp consent: ✓/✗ (default ✗ — separate consent needed)
- Marketing emails consent: ✓/✗ (separate from transactional)

Each toggle creates a new `customer_consents` row (immutable log). The `customers` row reflects the latest state. Right-to-erasure: anonymize PII fields, keep `customers` row + audit trail.

---

## Customer merge tool (admin)

Two existing customers turn out to be the same person. UI:

1. Admin opens "Merge customers" dialog from one customer's card
2. Picks the other customer (search)
3. Side-by-side comparison shows differences
4. Admin picks which fields to keep (survivor wins by default; can choose victim's value field-by-field)
5. Confirm → all jobs, invoices, storage_rentals, notes, photos move to survivor; victim is soft-deleted with merge marker pointing to survivor
6. Audit log entry: `customer_merged`, both IDs

Merges are reversible within 30 days via admin-only "Undo merge" — splits the records back. After 30 days, hard-archived.

---

## Duplicate detection (foundation for Phase 4 AI)

Phase 3 ships rule-based duplicate detection:
- Exact email match
- Exact phone match
- Same postcode + first 4 chars of last name match

Phase 4 adds AI-driven fuzzy detection (Claude API) on top.

---

## Acceptance criteria

- [ ] Customer list loads in <500ms with 5000 seed customers
- [ ] Search returns relevant matches in <300ms
- [ ] Create individual customer end-to-end works
- [ ] Create business customer with multiple contacts works
- [ ] Customer 360 page renders all 7 tabs with seed data
- [ ] LTV calculated correctly (verify against manual sum)
- [ ] Edit customer triggers optimistic concurrency conflict on stale version
- [ ] Soft-delete customer hides from list, visible in trash bin
- [ ] Merge customers moves all dependent records, soft-deletes victim
- [ ] Marketing consent toggle creates audit log entry
- [ ] CSV export downloads filtered customer list as `customers-YYYY-MM-DD.csv`
- [ ] Mobile responsive (Painless team uses iPads)

---

## Files created

```
src/
├── app/dashboard/customers/
│   ├── page.tsx (list)
│   ├── new/
│   │   ├── page.tsx
│   │   ├── individual-form.tsx
│   │   └── business-form.tsx
│   ├── [id]/
│   │   ├── page.tsx (card)
│   │   ├── edit/page.tsx
│   │   ├── tabs/
│   │   │   ├── jobs-tab.tsx
│   │   │   ├── storage-tab.tsx
│   │   │   ├── invoices-tab.tsx
│   │   │   ├── communications-tab.tsx
│   │   │   ├── notes-tab.tsx
│   │   │   ├── relationships-tab.tsx
│   │   │   └── activity-tab.tsx
│   │   └── merge/page.tsx
│   └── trash/page.tsx (soft-deleted)
├── lib/
│   ├── actions/customers.ts
│   ├── schemas/customer.ts
│   └── queries/customers.ts (server-side data fetching helpers)
└── components/domain/
    ├── customer/
    │   ├── CustomerCard.tsx
    │   ├── CustomerStats.tsx
    │   ├── ConsentToggle.tsx
    │   ├── DuplicateWarning.tsx
    │   └── MergeDialog.tsx
    └── shared/
        └── PostcodeAutocomplete.tsx
```

---

## Out of scope

- AI duplicate detection (Phase 4)
- Communications timeline backfill from SMS/WhatsApp (Phase 13)
- Customer-facing portal (post-1.0)
