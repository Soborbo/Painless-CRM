# Phase 10 — Job Execution

**Status**: Skeleton
**Duration estimate**: 3 weeks
**Prerequisite**: Phase 09 (worker PWA)

---

## Goal

The day-of-move and pre-move documentation: video surveys, cubic sheet, job sheet, photo timeline, and admin/staff notes. This is what gets built up between "quote accepted" and "customer signs off" — the operational record.

## Deliverables

1. Video survey ingestion: customer self-records via Liveswitch SDK and uploads
2. Survey detail form: surveyor fills cubic feet, complications, special handling notes
3. Cubic sheet: itemized inventory (room-by-room) with cubic ft per item
4. Job sheet: end-of-day form for loaders (actual hours, complications, materials used)
5. Admin/staff notes split: admin notes (sales-facing) vs staff notes (ops-facing) with permission gating
6. Photo timeline: chronological view of all photos with category badges
7. Video ingest from external sources: WhatsApp link drop, Dropbox link drop, direct upload — all attach to customer card
8. AI cubic estimate (Anthropic Claude with vision) on uploaded video — suggests cubic ft, surveyor confirms

## Key decisions

- **DECISION**: Liveswitch v1 scope — upload-only (customer records on phone, uploads to bucket) vs full live SDK (real-time video call). Recommendation: upload-only for v1, full SDK in post-1.0.
- **DECISION**: AI cubic estimate accuracy threshold — set conservatively (under-estimate) since over-estimate burns customer trust. Surveyor always reviews.
- **DECISION**: Where do externally-shared videos live? Recommendation: pull and rehost in Supabase Storage so links don't rot.

## Schema additions

```sql
create table surveys (
  id uuid primary key,
  company_id uuid not null,
  job_id uuid not null references jobs(id),
  surveyor_id uuid references users(id),
  survey_type text check (survey_type in ('video_self', 'video_live', 'in_person', 'estimate_only')),
  scheduled_at timestamptz,
  completed_at timestamptz,
  cubic_ft_estimate numeric,
  cubic_ft_ai_estimate numeric,
  cubic_ft_confidence text check (cubic_ft_confidence in ('low', 'medium', 'high')),
  complications jsonb default '[]',  -- list of complication codes encountered
  notes_internal text,
  notes_for_customer text,
  source_video_url text,
  ai_analysis jsonb,  -- raw output from Claude vision
  created_at timestamptz default now()
);

create table cubic_sheet_items (
  id uuid primary key,
  company_id uuid not null,
  survey_id uuid not null references surveys(id),
  room text,         -- 'living_room', 'bedroom_1', 'kitchen', etc.
  item text not null,
  quantity int default 1,
  cubic_ft_each numeric not null,
  cubic_ft_total numeric generated always as (quantity * cubic_ft_each) stored,
  fragile boolean default false,
  dismantle_required boolean default false,
  notes text
);

create table job_sheets (
  id uuid primary key,
  company_id uuid not null,
  job_id uuid not null references jobs(id),
  worker_id uuid not null references workers(id),
  actual_hours numeric not null,
  actual_cubic_ft numeric,
  materials_used jsonb,  -- e.g., { boxes_used: 12, tape_rolls: 3, blankets: 8 }
  complications_encountered text,
  damage_reported boolean default false,
  damage_details text,
  customer_satisfaction_score int check (customer_satisfaction_score between 1 and 10),
  submitted_at timestamptz default now()
);

create table notes (
  id uuid primary key,
  company_id uuid not null,
  parent_type text check (parent_type in ('customer', 'job', 'storage_rental')),
  parent_id uuid not null,
  category text check (category in ('admin', 'staff', 'customer_visible')) default 'admin',
  body text not null,
  body_html text,                  -- rendered markdown
  mentions uuid[],                 -- user IDs mentioned via @
  created_by_id uuid references users(id),
  created_at timestamptz default now(),
  edited_at timestamptz,
  pinned boolean default false
);

create index notes_parent_idx on notes(parent_type, parent_id, created_at desc);
```

## Permission rules

- `admin` notes visible to: admin, manager, sales, accounts
- `staff` notes visible to: admin, manager, surveyor, loader
- `customer_visible` notes visible everywhere (rare; e.g., "Customer prefers AM appointments")

## AI cubic estimation

```ts
// src/lib/integrations/anthropic/cubic-estimate.ts
import Anthropic from '@anthropic-ai/sdk';

export async function estimateCubicFromVideo(videoUrl: string): Promise<{
  estimate: number;
  confidence: 'low' | 'medium' | 'high';
  inventory: Array<{ room: string; item: string; qty: number; cubic_ft_each: number }>;
  reasoning: string;
}> {
  // 1. Extract frames every 5 seconds (use Cloudflare Stream or ffmpeg-wasm)
  // 2. Pass key frames to Claude with vision
  // 3. Parse structured response
  // 4. Conservative bias: when uncertain, under-estimate (better to over-deliver)
}
```

Surveyor always reviews and confirms. AI estimate stored alongside human estimate for accuracy benchmarking. Over time, build feedback loop.

## Acceptance criteria

- [ ] Customer receives "Record a quick video tour" link, records on phone, uploads
- [ ] Surveyor opens job, sees video, AI-suggested cubic ft, can edit
- [ ] Cubic sheet pre-populated from AI inventory; surveyor adjusts
- [ ] WhatsApp video URL pasted into job → fetched and rehosted
- [ ] Loader fills job sheet on PWA, hours auto-calculate from time entries
- [ ] Admin note tagged @-mention → mentioned user gets notification (Phase 15)
- [ ] Staff note hidden from sales rep view
- [ ] Photo timeline grouped by category, filterable

## Out of scope

- Customer-facing inventory editor (post-v1)
- Auto-generation of customer-facing inventory PDF (Phase 11)
- Damage photo annotation tool (post-v1)
