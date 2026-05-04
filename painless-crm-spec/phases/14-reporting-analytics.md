# Phase 14 — Reporting & Analytics

**Status**: Skeleton
**Duration estimate**: 3 weeks
**Prerequisite**: Phase 04 (jobs), Phase 12 (invoicing), Phase 13 (comms)

---

## Goal

The reports Jay actually looks at: lead-to-quote conversion, source attribution with cost-per-lead and LTV, staff conversion ratios, SLA dashboard, storage occupancy trends. Plus the offline conversion uploads that close the loop with Google Ads + Meta CAPI.

## Deliverables

1. Dashboard home: KPI tiles (today + this week + this month + YoY)
2. Jobs analysis: stage funnel, conversion rates, time-in-stage, revenue by source
3. Storage analysis: occupancy %, churn rate, MRR, customer LTV
4. Source attribution: leads / quotes / wins / revenue per acquisition source, cost-per-lead from ads spend
5. Lead-quality scorecard: per source, conversion rate × avg job value × LTV — single composite score
6. Staff performance: leads handled, quote conversion %, avg job value, customer NPS
7. SLA dashboard: average response time, % within SLA, breaches by user
8. Google Ads offline conversion upload: when job stage hits `paid`, upload to Google Ads as Enhanced Conversion using `gclid` from attribution
9. Meta CAPI offline conversion upload: same, using `fbclid` / hashed PII
10. CSV / Excel export on every report
11. Scheduled reports: weekly / monthly email to admin
12. Custom report builder (basic): filter by date range, group by, metric

## Key decisions

- **DECISION**: Build reports as SQL views vs query at request time? Recommendation: views for stable reports, ad-hoc queries for custom builder. Cache common reports for 5 minutes.
- **DECISION**: BI tool integration (Metabase, etc.) — out of scope for v1; CSV export covers the need

## Schema additions

```sql
-- Materialized view for KPI dashboard (refresh every 15 min)
create materialized view kpi_dashboard as
select
  company_id,
  count(*) filter (where stage in ('lead', 'contacted')) as active_leads,
  count(*) filter (where stage = 'quoted') as awaiting_response,
  count(*) filter (where stage = 'confirmed' and move_date::date between current_date and current_date + 7) as upcoming_week,
  sum(quote_total_pence) filter (where stage = 'paid' and updated_at::date >= date_trunc('month', current_date)) as mtd_revenue_pence,
  count(*) filter (where stage = 'paid' and updated_at::date >= date_trunc('month', current_date)) as mtd_jobs_paid
from jobs
where deleted_at is null
group by company_id;

create index on kpi_dashboard(company_id);

create table offline_conversion_uploads (
  id uuid primary key,
  company_id uuid not null,
  job_id uuid not null references jobs(id),
  network text check (network in ('google_ads', 'meta')),
  conversion_type text,
  conversion_value_pence int not null,
  conversion_currency text default 'GBP',
  click_id text,           -- gclid or fbclid
  uploaded_at timestamptz,
  upload_status text check (upload_status in ('queued', 'uploaded', 'failed', 'skipped_no_click_id')),
  upload_response jsonb,
  retry_count int default 0,
  created_at timestamptz default now()
);
```

## Pages

```
/dashboard                                  # KPI home
/dashboard/reports
  ├── jobs                                  # Funnel + conversion
  ├── storage                               # Occupancy + churn
  ├── sources                               # Acquisition + LTV per source
  ├── staff                                 # Per-rep performance
  ├── sla                                   # Response times + breaches
  ├── financial                             # Revenue, AR aging, P&L summary
  └── custom                                # Custom report builder
```

## KPI dashboard (the one Jay sees first)

Top row tiles:
- New leads today / this week / this month (with % vs prev period)
- Quotes sent today / this week
- Jobs confirmed for next 7 days
- Revenue MTD (with target line if set)
- Active storage rentals + MRR

Middle row charts:
- Daily lead volume, last 30 days (line)
- Quote conversion rate by source (bar)
- Revenue by month, last 12 months (column)

Bottom row:
- Recent activity feed (audit log filtered to important events)
- Tasks overdue (any phase with SLA breach)

## Source attribution (the one that pays back)

For each acquisition source, show:
| Source | Leads | Quotes | Wins | Revenue | Conv% | CPL | LTV | Score |

`Score` = `Conv% × Avg Job Value × Repeat Rate` — composite ranking that surfaces high-value sources. Affiliate, Estate Agent partnerships, B2B Outreach should rise above generic Google clicks here.

CPL = ad spend / leads (manually entered ad spend per source per month, or pulled via Google Ads / Meta API in post-v1).

## Offline conversion upload

```ts
// src/lib/integrations/google-ads/offline-conversions.ts
import { GoogleAdsApi } from 'google-ads-api';

export async function uploadJobConversion(jobId: string) {
  // 1. Read job, customer, attribution.gclid, paid invoices
  // 2. If gclid present and conversion not yet uploaded:
  //    - Build click conversion payload
  //    - POST to Google Ads API
  //    - Record upload in offline_conversion_uploads
  // 3. If fbclid present, same for Meta CAPI
}
```

Triggered on job stage transition to `paid` (via automation rule). Cron retry for failures (every hour, max 5 retries, then admin alert).

Uses Enhanced Conversions for Leads (UK-specific): hashed email + phone passed alongside gclid for resolution when click_id alone is insufficient.

## Acceptance criteria

- [ ] KPI dashboard loads in <800ms with 5K jobs in DB
- [ ] Source attribution table accurate against manual spreadsheet check
- [ ] Job funnel chart shows correct conversion rates per stage transition
- [ ] Staff performance: each rep's quote conversion matches manual count
- [ ] Offline conversion uploaded to Google Ads within 1h of `paid` transition
- [ ] Custom report builder: filter by date + source, group by month, sum revenue
- [ ] CSV export from any report works in Excel without escape issues
- [ ] Weekly digest email sent every Monday 09:00 to admin

## Out of scope

- Real-time analytics (15-min refresh is enough)
- Cohort analysis (post-v1)
- Predictive forecasting (post-v1)
- Multi-touch attribution (last-click only)
