# Phase 17 — Migration & Go-Live

**Status**: Skeleton (last phase before v1.0 release)
**Duration estimate**: 3 weeks
**Prerequisite**: All previous phases complete + UAT-ready

---

## Goal

Move Painless from iMVE to painless-crm. Active jobs migrated, historical data archived as read-only reference. Jay trained. Fallback plan in place. Full cutover at a planned moment, not gradual confusion.

## Deliverables

1. iMVE data export (CSV / Excel) — all entities Jay needs
2. Migration scripts: customer, jobs, invoices, storage rentals
3. Active vs archive split: last 12 months active = full migration; older = read-only archive table
4. Migration validation: row counts, sum totals, sample audits
5. Staging migration dry-run with full data
6. Go-live checklist + cutover runbook
7. Jay + team training (3 sessions, recorded)
8. Fallback plan: if go-live fails, rollback to iMVE within 4h
9. First-week support cadence (Laszlo on call)

## Key decisions

- **DECISION**: Migration scope — recommendation: 12 months active full, 24 months earlier read-only, drop pre-2024 unless legally required
- **DECISION**: Cutover timing — Friday evening 18:00 → Sunday evening, Painless office closed during transition
- **DECISION**: Phone numbers and email forwarding — DNS / forwarding addresses already point to painlessremovals.com (no change); Tamar forwarding moves to CRM email parser

## Pre-cutover steps

1. **Week T-3**: Export iMVE data to CSVs. Quality check: how clean? document gotchas.
2. **Week T-3**: Run import script against staging Supabase. Diff active customer counts, job counts, invoice totals against iMVE.
3. **Week T-2**: Jay reviews migrated data on staging. Fixes any errors in iMVE that should propagate, or document overrides.
4. **Week T-2**: Run full UAT script (50 scenarios) against staging.
5. **Week T-1**: Train Jay + team on staging. 3 sessions: sales reps (kanban, customer card, quote builder), admin (settings, reports, invoicing), loaders (PWA).
6. **Week T-1**: Lock in cutover date. Notify customers in flight (e.g., email "Heads up, our system upgrade may briefly affect responses on Saturday").
7. **Day T-1**: Final iMVE export. Tag iMVE as read-only.

## Cutover runbook (Friday 18:00 to Sunday 18:00)

Hour-by-hour:

```
T-0  (Fri 18:00) : Final iMVE export (CSV dump)
T+1  : Staging final import + diff vs production iMVE
T+3  : Verify totals (customers, jobs, revenue, storage rentals) match
T+4  : DNS swap: crm.painlessremovals.com → production deploy
T+5  : Smoke test: login, kanban, quote builder, PWA, webhook from painlessremovals
T+8  : Painlessremovals webhook flips from iMVE adapter to CRM
T+12 : Light testing throughout Saturday by Laszlo
T+24 : Sunday morning — Jay reviews and signs off
T+48 : Sunday 18:00 — Monday morning office reopens on new system
```

Communication plan:
- Pre-cutover email to active leads: "Quick note about our system upgrade…"
- Pre-cutover email to active storage customers: no impact, but heads up
- Outage page on `crm.painlessremovals.com` during transition (2 hours window)

## Migration script structure

```
migration/
├── 01-extract-imve.ts          # Reads iMVE CSV exports, normalizes
├── 02-validate-source.ts       # Lints source data: missing fields, duplicates, dates
├── 03-build-customers.ts       # B2C/B2B classification, dedup, address linking
├── 04-build-addresses.ts       # Postcode validation, geocoding cache
├── 05-build-jobs.ts            # Stage mapping (iMVE statuses → painless-crm enum)
├── 06-build-quotes.ts          # Pricing version snapshots (best-effort approximation)
├── 07-build-invoices.ts        # Xero invoice IDs preserved if exportable
├── 08-build-storage.ts         # Active rentals + DD mandate carryover
├── 09-build-affiliates.ts
├── 10-build-attributions.ts
├── 11-archive-historical.ts    # Old data → archive_imve table, read-only view
├── 12-verify.ts                # Row counts, sums, sample diff
└── 13-go-live.ts               # Final flip: webhook adapter swap, DNS update prompt
```

## Verification queries

```sql
-- Customer count match
select count(*) from customers where company_id = '...' and deleted_at is null;
-- vs iMVE export: 1,742 ✓

-- Total jobs ever migrated
select count(*) from jobs where company_id = '...' and deleted_at is null;
-- vs iMVE: 1,851 ✓

-- Sum of paid invoices migrated (sanity check on revenue)
select sum(total_pence) / 100.0 as total_gbp from invoices
where company_id = '...' and status = 'paid' and deleted_at is null;
-- vs Xero: £X,XXX,XXX ✓

-- Active storage rentals
select count(*) from storage_rentals
where company_id = '...' and status = 'active';
-- vs iMVE: 23 ✓
```

## Fallback plan

If by Sunday 14:00 critical issues remain:
1. Flip painlessremovals webhook back to iMVE adapter (1 line change in env var)
2. CRM goes into "read-only mode" (admin can view migrated data; no new writes)
3. Jay continues operating in iMVE for the week
4. Laszlo investigates / fixes
5. Re-attempt cutover next weekend

Rollback assumption: iMVE data was untouched after T-0. iMVE remains the source of truth until cutover succeeds. CRM additions during the failed window are exported and re-imported on retry.

## Training plan

3 × 90-minute sessions, recorded, supplemented with Loom walkthroughs:

**Session 1 — Sales reps (Tom, Tamara, Pete)**
- Login + dashboard
- Kanban: drag, click, filter
- Customer card and search
- Quote builder
- Sending quotes, follow-ups
- Notes and @mentions

**Session 2 — Admin / Manager (Jay, Lara)**
- Settings: pricing, templates, automation rules
- Reports: KPI dashboard, source attribution, staff performance
- Affiliate management
- User management
- Invoicing, Xero sync, GoCardless mandates
- SLA dashboard

**Session 3 — Loaders (PWA-only)**
- Install PWA
- Magic link login
- Today's jobs view
- Clock-in (with GPS)
- Vehicle check
- Photo upload
- End-of-job sheet
- Customer sign-off flow

Quick-reference cards (1-pager PDFs) for each role + Loom links pinned in `dashboard/help`.

## Acceptance criteria

- [ ] All last-12-months active jobs migrated with correct stage mapping
- [ ] All open invoices migrated with correct status
- [ ] All active storage rentals + DD mandates migrated
- [ ] All affiliates and historical attributions migrated
- [ ] Sample audit: 20 random jobs verified end-to-end against iMVE
- [ ] Total revenue figures match Xero
- [ ] All 3 training sessions completed and recorded
- [ ] Cutover executed without critical incidents
- [ ] Day 1 (Monday) operating on new system without escalations
- [ ] Day 7 retrospective: any issues found, listed, prioritized

## Post-launch (week +1 to +4)

- Daily standup (Laszlo + Jay + Lara) for 1 week
- Weekly check-in for 3 weeks following
- Issue triage: critical = same day, high = within 48h, normal = next sprint
- v1.0 retrospective at week +4: what went well, what would we do differently

## Out of scope

- Multi-tenant onboarding for second customer (post-v1)
- Public marketing of the SaaS product (post-v1)
- White-label customization (post-v1)
- Migration from other CRMs besides iMVE (post-v1; though many patterns will reuse)
