# Phase 07 — Capacity & Dynamic Pricing

**Status**: Skeleton
**Duration estimate**: 3 weeks
**Prerequisite**: Phase 05 (pricing) + Phase 08 (resources, for capacity calc)

---

## Goal

Painless's revenue management feature. Admin-configured capacity per day; jobs consume capacity; utilization drives a public traffic-light calendar; calendar tier modulates margin via the pricing engine. Ship with quote freeze (issued quotes don't change), framed as "midweek discount" not "surge pricing".

## Deliverables

1. Capacity calculation: nightly + on job assignment change
2. Cloudflare KV broadcast: `availability:YYYY-WW` keyed
3. Public availability page on `painlessremovals.com/availability` (Astro, reads KV)
4. Calendar widget embeddable in calculator step 2 (date picker)
5. Dynamic pricing toggle in pricing engine (Phase 5 prepared the fields)
6. Quote freeze: quote retains its calculated price for `quote_validity_days` regardless of band changes
7. Admin override per day (force green/yellow/red, document reason)
8. Per-source modulation (e.g., dynamic pricing only on `organic`, not on `b2b_outreach`)

## Key decisions

- **DECISION**: Capacity granularity — daily or AM/PM split? (Recommendation: daily for v1, AM/PM in Phase 14+)
- **DECISION**: Public visibility — 6 weeks ahead max (anti-competitor-gaming default), configurable
- **DECISION**: Vulnerable customer override — admin can manually quote at "green" rate even on red days; reason recorded; override count visible to manager

## Schema

```sql
create table capacity_overrides (
  id uuid primary key,
  company_id uuid not null,
  date date not null,
  forced_band text check (forced_band in ('green', 'yellow', 'red', 'closed')),
  reason text not null,
  applied_by_id uuid references users(id),
  applied_at timestamptz default now()
);

create unique index on capacity_overrides(company_id, date);

create materialized view daily_capacity_utilization as
  select
    company_id,
    move_date::date as date,
    sum(estimated_hours * crew_size) as committed_man_hours,
    -- max_man_hours per day from settings.business_hours * crew count
    -- band derived in app code
  from jobs
  where stage in ('confirmed', 'in_progress')
    and deleted_at is null
  group by company_id, move_date::date;

-- Refresh: cron-triggered, also on job status change via trigger
```

## Public page (painlessremovals)

```astro
---
// painlessremovals/src/pages/availability.astro
import { getAvailabilityCalendar } from '@/lib/availability';
const weeks = await getAvailabilityCalendar();  // reads KV
---
<Layout title="Availability">
  <CalendarGrid weeks={weeks} />
  <Legend />
  <CTAButton href="/instantquote">Get a quote for an available date</CTAButton>
</Layout>
```

## Quote modulation flow

When `calculateQuote()` runs, look up `availability_band(date)`:
1. Read from KV `availability:YYYY-WW`
2. If band found and `dynamic_pricing_enabled` and source in `modulation_sources`:
   - Apply `margin_delta` from the matching `capacity_band`
3. Record band in quote's breakdown for transparency

## Acceptance criteria

- [ ] Capacity calculation runs nightly via Cloudflare Cron
- [ ] Capacity recalculates within 60s of job stage change
- [ ] Public availability page shows next 6 weeks color-coded
- [ ] Calculator step 2 highlights green dates as "save 5%"
- [ ] Quote issued at green rate stays at green rate for 7 days even if day flips to yellow
- [ ] Admin override marks day red, all calculator quotes for that day use red modulation
- [ ] Per-source rule: `b2b_outreach` quotes ignore dynamic modulation
- [ ] Audit log captures every override

## Out of scope

- Time-of-day tiers (post-v1)
- Surge based on weather forecast (post-v1)
- AI demand forecasting (post-v1)
