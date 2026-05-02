# Phase 08 — Resource Management

**Status**: Skeleton
**Duration estimate**: 4 weeks
**Prerequisite**: Phase 02 schema, Phase 04 jobs

---

## Goal

Vehicles, storage facilities, contractors, and the daily rota that ties them to jobs. This is the operational backbone — without it, the worker PWA (Phase 9) and capacity calendar (Phase 7) have nothing to consume.

## Deliverables

### Vehicles

1. Vehicle CRUD (vans, trailers): registration, type, monthly cost, capacity in cuft
2. Compliance tracking: MOT, road tax, insurance, last service dates
3. Auto-reminders: 30/14/7 days before each compliance expiry (email + dashboard alert)
4. Vehicle assignment log: who drove each van each day, who was the daily reviewer

### Storage

5. Storage sites: warehouse address, total container capacity
6. Containers within sites: ID, size, current customer (if occupied), monthly rate
7. Storage rental lifecycle: available → reserved → occupied → vacated
8. Container map view per site

### Workers (contractors)

9. Worker profiles: name, contact, hourly rate, skills/certifications
10. Worker availability poll (PWA in Phase 9): weekly form "I'm available these days"
11. Worker performance: jobs completed, hours, customer rating average
12. Contractor invoices auto-prepared at week end

### Rota

13. Daily rota view: calendar grid (date × resources), jobs slotted in
14. Drag-drop assignment: pull a job, drop on a worker × van × date cell
15. Conflict detection: worker can't be on two jobs simultaneously
16. Rota print view (paper backup)

## Schema additions

```sql
alter table vehicles add column compliance_alerts_enabled boolean default true;

create table vehicle_assignments (
  id uuid primary key,
  company_id uuid not null,
  vehicle_id uuid not null references vehicles(id),
  date date not null,
  driver_id uuid references workers(id),
  daily_reviewer_id uuid references workers(id),  -- responsible for vehicle that day
  notes text,
  created_at timestamptz default now()
);

create unique index on vehicle_assignments(vehicle_id, date);

create table worker_availability (
  id uuid primary key,
  company_id uuid not null,
  worker_id uuid not null references workers(id),
  date date not null,
  available boolean not null,
  notes text,
  submitted_at timestamptz default now()
);

create unique index on worker_availability(worker_id, date);

create table job_assignments (
  id uuid primary key,
  company_id uuid not null,
  job_id uuid not null references jobs(id),
  worker_id uuid not null references workers(id),
  vehicle_id uuid references vehicles(id),
  date date not null,
  role text check (role in ('lead_loader', 'loader', 'driver', 'surveyor')),
  scheduled_start time,
  scheduled_end time,
  notes text,
  created_at timestamptz default now()
);
```

## Pages

```
/dashboard/vehicles                       # List + add vehicle
/dashboard/vehicles/[id]                  # Detail + compliance log
/dashboard/storage                        # All sites
/dashboard/storage/[siteId]               # Container grid + occupancy
/dashboard/storage/[siteId]/[containerId] # Container history + current customer
/dashboard/workers                        # Worker list
/dashboard/workers/[id]                   # Profile + availability + performance
/dashboard/rota                           # Daily/weekly rota view
/dashboard/rota/[date]                    # Detailed day view, drag-drop
```

## Compliance auto-reminders

Cloudflare Cron at 06:00 daily:
1. Query vehicles with `mot_due` / `tax_due` / `insurance_due` / `next_service` dates
2. For each upcoming threshold (30/14/7 days), if not yet alerted, send Resend email to admin
3. Mark `compliance_alert_sent` in `vehicle_compliance_alerts` table to prevent dupes

## Storage occupancy

Container `status` derived:
- `available`: no active rental
- `reserved`: rental in `pending` state with future start date
- `occupied`: rental active
- `maintenance`: admin-flagged

Site occupancy = occupied / total. Dashboard widget per site.

## Worker availability flow

Friday 10:00 AM Cron:
- For each active worker with PWA login: send "Submit your availability for next week" push notification
- For workers without login: SMS link to public availability form

Following Monday 09:00 AM:
- Notification to admin: "X of Y workers have submitted availability for week of {date}"

## Acceptance criteria

- [ ] Add vehicle, set MOT date 25 days from now, receive 30-day alert email
- [ ] Container marked occupied when storage rental starts; vacated when terminated
- [ ] Site occupancy widget reflects live state
- [ ] Worker submits availability via PWA, visible in rota view
- [ ] Drag job to worker × van × date in rota — conflict detected if worker already assigned
- [ ] Daily reviewer field auto-populates from previous day's assignment as default
- [ ] Rota print view fits A4, readable

## Out of scope

- AI route optimization (Phase 13+)
- GPS tracking of vehicle movements (separate telematics provider)
- Vehicle expense ledger beyond compliance dates (post-v1)
