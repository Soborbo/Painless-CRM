# Phase 09 — Worker PWA (iOS-aware)

**Status:** Skeleton (v2 — iOS foreground sync mandated)
**Duration estimate:** 4 weeks
**Prerequisite:** Phase 01 (auth, magic links), Phase 08 (rota assignments)
**Version:** v0.2 (post-launch)
**Related:** SECURITY_MODEL.md §3, DECISIONS.md ADR-011

---

## Goal

Mobile-first Progressive Web App for loaders and drivers. Offline-first because Bristol postcodes have signal black spots. Magic-link login (no remembered passwords). Functions: see today's job, clock in with GPS check, complete vehicle check, upload photos, complete end-of-job sheet, get push for new assignments.

## Critical: iOS Safari constraints (don't underestimate)

iOS Safari / WKWebView **does not reliably support** Background Sync API or Periodic Background Sync. A naive offline-first PWA on iPhone will silently lose data when the app is backgrounded or the phone sleeps. ADR-011 documents the v2 mandates:

1. **Visible "Sync now" button always present** in the PWA top bar
2. **Visible unsynced item counter** (e.g., badge: "3 items waiting")
3. **Foreground auto-sync** on every app open and on every navigation
4. **Server-side stale clock-in detection**: if a worker has an active `clock_in` time entry but no related writes in 6 hours, push a notification "we haven't received your data — please open the app"
5. **IndexedDB queue is durable** — entries persist across app reinstalls (test this explicitly)
6. **End-of-day reconciliation reminder** at the worker's expected end-of-shift if any items are unsynced

A worker should never end the day with unsynced data without the app having alerted them.

## What changed from v1

v1 said "background sync API with exponential retry". v2 says "background sync where available, mandatory foreground sync on iOS". The IndexedDB queue is the same. The user-facing UI is more deliberately surfaced.

## Deliverables

1. PWA manifest, service worker, installable on iOS Safari and Android Chrome
2. Magic-link login flow (no password). 7-day session per SECURITY_MODEL.md §3.
3. Today's jobs view: cards for each assigned job, status (upcoming/in-progress/done)
4. Job detail: addresses, customer name, contact phone (tap to call), notes from sales
5. Clock-in flow: GPS verification — flag if pressed >500m from job address (configurable per company in `settings.gps_clock_in_threshold_m`)
6. Vehicle pre-check form (digital signature, photo of dashboard)
7. Photo upload: before / during / after / damage, multi-select, offline queue
8. Time entries (start of move, end of load, end of unload, end of job)
9. End-of-job sheet: actual cubic feet, complications encountered, customer satisfaction note (1–5, internal)
10. Push notifications: new assignment, schedule change, message from admin
11. **Offline queue UI**: top bar with sync status + counter + "Sync now" button + last-synced timestamp
12. **Foreground sync** on app open, navigation, and every 60s when online
13. **Stale clock-in detector** (server-side cron, push notification when triggered)
14. Vehicle check submission appears in admin UI in real time (Supabase Realtime)

## Decisions (resolve before implementation)

- **OD-2 (open):** Vehicle check form on painlessremovals.com — keep public or move to PWA only? Recommendation: PWA only, less attack surface, simpler ownership.
- **GPS variance threshold:** 500m default, configurable per company in `settings.gps_clock_in_threshold_m`.
- **Push:** Web push only (no native iOS app). Web push works on iOS 16.4+. Painless's crews are all on iOS 17+ as of 2026.
- **Photo storage:** Supabase Storage in v0.2. Migrate to Cloudflare R2 in v0.3 if costs balloon.

## Schema additions

```sql
create table time_entries (
  id uuid primary key,
  company_id uuid not null,
  job_id uuid not null references jobs(id),
  worker_id uuid not null references workers(id),
  type text check (type in ('clock_in', 'load_start', 'load_end', 'unload_start', 'unload_end', 'clock_out', 'break_start', 'break_end')),
  occurred_at timestamptz not null,
  -- Client-generated UUID for idempotent upsert from offline queue
  client_event_id uuid not null,
  gps_lat numeric(10, 7),
  gps_lng numeric(10, 7),
  gps_accuracy_m numeric,
  distance_from_job_address_m numeric,  -- computed at insert
  flagged boolean default false,         -- distance > threshold
  -- Sync provenance
  synced_at timestamptz default now(),   -- when the server received this entry
  client_recorded_at timestamptz,        -- when the worker actually pressed the button
  notes text,
  created_at timestamptz default now(),
  unique (worker_id, client_event_id)
);

create index time_entries_job_idx on time_entries(job_id, occurred_at);
create index time_entries_worker_period_idx on time_entries(worker_id, occurred_at desc);
-- For stale clock-in detection
create index time_entries_active_clock_in_idx on time_entries(worker_id, type)
  where type = 'clock_in';

create table vehicle_checks (
  id uuid primary key,
  company_id uuid not null,
  vehicle_id uuid not null references vehicles(id),
  job_id uuid references jobs(id),
  worker_id uuid not null references workers(id),
  date date not null,
  client_event_id uuid not null,
  fuel_level int check (fuel_level between 0 and 100),
  mileage int,
  walk_around_clear boolean,
  defects_noted text,
  dashboard_photo_url text,
  signature_data_url text,
  submitted_at timestamptz default now(),
  client_recorded_at timestamptz,
  unique (worker_id, client_event_id)
);

create table photos (
  id uuid primary key,
  company_id uuid not null,
  job_id uuid not null references jobs(id),
  uploaded_by_worker_id uuid references workers(id),
  uploaded_by_user_id uuid references users(id),
  category text check (category in ('before', 'during', 'after', 'damage', 'inventory', 'paperwork')),
  url text not null,
  thumbnail_url text,
  client_event_id uuid not null,
  notes text,
  taken_at timestamptz,
  uploaded_at timestamptz default now(),
  client_recorded_at timestamptz,
  unique (uploaded_by_worker_id, client_event_id)
);
```

The `client_event_id` columns are critical for the offline queue: the PWA generates a UUID for every action before going offline, and the server upserts using that UUID as the dedup key. This makes retry safe.

## Pages (PWA, separate route group)

```
src/app/(worker)/
├── layout.tsx              -- PWA shell with sync status bar
├── login/page.tsx          -- email → magic link
├── home/page.tsx           -- today's jobs + sync status
├── jobs/[id]/
│   ├── page.tsx            -- job overview
│   ├── clock-in/page.tsx
│   ├── vehicle-check/page.tsx
│   ├── photos/page.tsx
│   ├── sheet/page.tsx      -- end-of-job
│   └── signoff/page.tsx    -- customer signs (Phase 11)
└── availability/page.tsx   -- weekly poll (Phase 8)
```

## Offline queue pattern (v2)

```ts
// src/app/(worker)/_lib/offline-queue.ts
//
// IndexedDB-backed queue. Each action:
//   { client_event_id, type, payload, attempts, created_at, last_attempt_at?, last_error? }
//
// Sync triggers (in priority order):
//   1. User taps "Sync now" — runs immediately
//   2. App foreground (visibilitychange to visible)
//   3. Navigation event (any route change in the worker app)
//   4. Network online event
//   5. Periodic timer every 60s when online and app foregrounded
//   6. (Best-effort) Background Sync API where available
//
// Each item retries up to 5 times with exponential backoff (1s, 5s, 30s, 5m, 30m).
// After 5 failures, surface in UI with manual retry option.
//
// Server-side dedup uses client_event_id (UUID). Same client_event_id resubmitted = no-op.
```

The `(worker)` layout includes a top status bar:

```
┌─────────────────────────────────────┐
│ ☰  Today's Jobs    🟢 Synced 2m ago │  ← when all synced
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ ☰  Today's Jobs   🟡 3 unsynced [Sync] │  ← when items pending
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ ☰  Today's Jobs   🔴 No connection [Retry] │  ← offline
└─────────────────────────────────────┘
```

Tapping the status badge opens a modal with the queue contents (action descriptions, age, retry count, "Sync now", "Clear failed").

## GPS verification

On clock-in:

1. Get current position (high accuracy, 10s timeout)
2. Geocode job address (cached after first lookup; offline cache uses last-known geocode for assigned jobs at start of day)
3. Compute haversine distance
4. If > threshold (default 500m): show "You don't appear to be at the job site. Continue anyway?" with reason field
5. Store entry with `flagged = true` if user proceeds

Admin alert: if > N flagged clock-ins per worker per week (configurable, default 3), dashboard surfaces it for manager review.

## Stale clock-in detection (server-side cron)

A Cron job runs hourly:

```sql
-- Find workers who clocked in >6 hours ago without any subsequent
-- time_entry, photo upload, or vehicle_check
select te.worker_id, te.job_id, te.occurred_at
from time_entries te
where te.type = 'clock_in'
  and te.occurred_at < now() - interval '6 hours'
  and not exists (
    select 1 from time_entries te2
    where te2.worker_id = te.worker_id
      and te2.occurred_at > te.occurred_at
      and te2.type in ('clock_out', 'load_end', 'unload_end')
  )
```

For each match, send a push notification: "We haven't received any updates from your job since {time}. Please open the app to sync." Also write an `activity_log` entry for admin visibility.

## Acceptance criteria

1. Worker installs PWA on iPhone iOS 17+, opens, signs in via magic link
2. Today's jobs render correctly with assigned crew
3. Tap address → opens in Apple Maps
4. Clock-in within 500m of address: success
5. Clock-in 5km from address: warning + flagged record
6. **iOS specific:** With phone in airplane mode, complete clock-in + 3 photos + vehicle check; turn airplane mode off; verify all data syncs without user opening the app... wait, no — verify all data syncs **when the user opens the app** (do NOT rely on background sync)
7. **Sync status bar visible at all times** showing current state
8. **Manual "Sync now" button works** even when no auto-sync would have triggered
9. Offline queue persists across app close/reopen
10. Server-side dedup confirmed: re-syncing the same `client_event_id` does not create duplicate rows
11. Stale clock-in detector fires push notification within 1 hour of crossing 6-hour threshold
12. Admin sees vehicle check submission in real time via Supabase Realtime
13. End-of-job sheet auto-suggests cubic-feet from quote, worker can adjust
14. Push notification received for new assignment within 30s

## Test scenarios (run before sign-off)

- **iOS airplane-mode test:** complete a full job's worth of actions offline, then go online by opening the app — all should sync within 30s
- **App-killed test:** complete actions, force-quit the app, reopen — all should sync within 30s
- **Battery-saver test:** complete actions on iPhone in low-power mode — all should sync when app opens
- **6-hour stale test:** clock in, do nothing, ensure push notification fires
- **Bad GPS test:** clock in with GPS spoofed 5km away, ensure flag appears in admin UI

## Out of scope

- Worker-to-worker messaging (post-v0.2)
- Tip / commission tracking (post-v0.2)
- Performance leaderboard inside PWA (post-v0.2)
- Native iOS app (out of scope for v1)
- Periodic Background Sync (best-effort only — not relied upon)
