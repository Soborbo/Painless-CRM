# Phase 16 — Affiliate & Quality Layer

**Status**: Skeleton
**Duration estimate**: 2 weeks
**Prerequisite**: Phase 04 (jobs), Phase 11 (signoff/complaints), Phase 14 (reporting)

---

## Goal

The "growth + accountability" surface. Affiliate dashboard for estate agents and B2B partners. Insurance / damages module integrated into job workflow. SLA dashboard for ops accountability. Lead-quality scorecard per source.

## Deliverables

1. Affiliate model: codes, attribution, commission tracking
2. Estate agent dashboard (limited login or portal): see their referrals, status, payments due
3. Affiliate payout report (admin-side)
4. Insurance & damages tracking: claim lifecycle, attached photos, payouts, insurance ref
5. SLA dashboard: per-stage average response time, breach %, leaderboard
6. Lead-quality scorecard: composite score per source (already in Phase 14, extended here with action triggers — auto-pause poor sources)
7. Repeat-claim pattern detection: flag customers who file 2+ damage claims (admin-only)
8. Customer health score: composite of NPS + recency + storage activity (signal of churn risk)

## Key decisions

- **DECISION**: Affiliate portal — separate domain or sub-route? Recommendation: `/partners/[code]` with limited-access magic link login, no full role
- **DECISION**: Commission structure — % of revenue, flat fee per won job, or hybrid? Configurable per affiliate
- **DECISION**: Damages > insurance threshold auto-flag — when damage payout > £500, escalate to admin; configurable

## Schema additions

```sql
create table affiliates (
  id uuid primary key,
  company_id uuid not null,
  name text not null,
  type text check (type in ('estate_agent', 'B2B_partner', 'individual', 'other')),
  contact_name text,
  contact_email text,
  contact_phone text,
  address text,
  commission_type text check (commission_type in ('percent_revenue', 'flat_per_job', 'tiered')),
  commission_value numeric,            -- percent or pence
  commission_config jsonb,             -- tiered: [{ min_jobs: 10, percent: 7.5 }]
  payment_method text,
  active boolean default true,
  created_at timestamptz default now()
);

create table affiliate_codes (
  id uuid primary key,
  company_id uuid not null,
  affiliate_id uuid not null references affiliates(id),
  code text unique not null,           -- 'JONNY25', 'RELISHHQ'
  active boolean default true,
  created_at timestamptz default now()
);

create table attributions (
  id uuid primary key,
  company_id uuid not null,
  job_id uuid references jobs(id),
  customer_id uuid references customers(id),
  affiliate_id uuid references affiliates(id),
  affiliate_code text,
  source text,                         -- 'organic', 'google_ads', 'meta_ads', 'affiliate', 'b2b_outreach'
  campaign text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  gclid text,
  fbclid text,
  landing_page text,
  attributed_at timestamptz default now()
);

create index attributions_affiliate_idx on attributions(affiliate_id);
create index attributions_job_idx on attributions(job_id);

create table commission_records (
  id uuid primary key,
  company_id uuid not null,
  affiliate_id uuid not null references affiliates(id),
  job_id uuid not null references jobs(id),
  amount_pence int not null,
  status text check (status in ('pending', 'approved', 'paid', 'cancelled')),
  invoice_id uuid references invoices(id),  -- linked when settled
  approved_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz default now()
);

-- Damages module already partly defined in Phase 11; extending:
alter table damage_claims add column repeat_claim_flag boolean default false;
alter table damage_claims add column auto_escalated boolean default false;

create or replace function flag_repeat_claims() returns trigger as $$
begin
  if (
    select count(*) from damage_claims
    where company_id = NEW.company_id
      and job_id in (select id from jobs where customer_id = (
        select customer_id from jobs where id = NEW.job_id
      ))
      and id != NEW.id
  ) >= 1 then
    NEW.repeat_claim_flag := true;
  end if;
  return NEW;
end;
$$ language plpgsql;

-- Customer health (computed view)
create view customer_health as
select
  c.id as customer_id,
  c.company_id,
  -- NPS component (last sign-off score)
  coalesce(
    (select satisfaction_score from customer_signoffs cs
     join jobs j on j.id = cs.job_id
     where j.customer_id = c.id
     order by cs.signed_at desc limit 1),
    null
  ) as last_nps,
  -- Recency component
  (select max(j.updated_at) from jobs j where j.customer_id = c.id) as last_activity,
  extract(days from now() - (select max(j.updated_at) from jobs j where j.customer_id = c.id)) as days_since_activity,
  -- Storage signals
  exists(select 1 from storage_rentals sr where sr.customer_id = c.id and sr.status = 'active') as has_active_storage,
  -- Computed score (0-100)
  null::int as health_score  -- computed in app code
from customers c
where c.deleted_at is null;
```

## Affiliate / B2B partner portal

Separate route group `/partners/`. Magic-link login. Limited views:
- Their referrals (anonymized customer names — first name + initial only)
- Status of each (in pipeline / won / lost)
- Pending commissions
- Paid commissions history
- Refer-a-customer form (creates lead with affiliate code)

Affiliate session uses scoped JWT with `affiliate_id` claim, NOT a `users` row. Read-only access via service role + filters by `affiliate_id`.

## SLA dashboard (admin)

Shows:
- Each user's avg time-to-first-response per source
- Each user's avg time-in-`quoted` before response
- % of leads contacted within 1 hour
- Breach count per user this month
- Leaderboard (with caveat that this is for ops awareness, not punitive)

## Lead-quality scorecard auto-action

Cron weekly recomputes per-source score (Phase 14 already builds it). New in this phase: auto-actions:
- If score drops by >30% week-over-week: notify admin
- If score below threshold for 4 consecutive weeks: auto-pause (lead routing skips this source)
- Manual override always available

## Acceptance criteria

- [ ] Lead arrives with affiliate code → attribution created → commission_record on `paid` stage
- [ ] Affiliate portal login + dashboard works
- [ ] Damage claim with payout £600 auto-escalates to admin
- [ ] Customer with 2 damage claims flagged with repeat marker
- [ ] SLA dashboard accurate against manual sample (10 jobs)
- [ ] Auto-pause triggers when source score below threshold

## Out of scope

- Self-serve affiliate signup (post-v1; Jay onboards manually)
- Multi-tier affiliate (sub-affiliates) (post-v1)
- Integration with insurance broker API (post-v1)
