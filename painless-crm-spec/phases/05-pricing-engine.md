# Phase 05 — Pricing Engine

**Goal**: Single source of truth for pricing. CRM is the master, KV broadcasts to all consumers (calculator on painlessremovals.com, manual quote builder, public availability page). Old quotes pin to the version they were calculated under and never drift.

**Duration estimate**: 4 weeks
**Status**: Not started
**Prerequisite**: Phase 02 schema + Phase 04 jobs

---

## Why this phase

This is the **highest-leverage** phase in the build. Pricing is where Painless makes or loses margin. A single source of truth — owned by Jay in the admin UI, broadcast to every quote-generating surface — is the difference between "we should change pricing but it's a 3-day dev project" and "Jay clicks save and everyone sees the new price in 60 seconds".

This phase modifies **two repositories**: `painless-crm` (this one) and `painlessremovals` (the public site). Plan accordingly.

---

## Deliverables

### CRM side

1. Pricing admin page (admin/manager only)
2. `pricing_versions` versioning UI (history, revert, A/B test prep)
3. Pricing calculation engine (TypeScript, mirrors v4.2 logic)
4. KV broadcast on save (write to `pricing:current`)
5. Webhook handler for inbound quotes from calculator
6. Quote creation Server Action that snapshots active pricing
7. Pricing simulator (admin tool — input scenario, see resulting quote)

### Painlessremovals side

8. `painlessremovals/src/lib/pricing/` refactor: read from CRM-published source instead of hardcoded constants
9. KV read with build-time fallback to baked-in last-known-good
10. Backwards-compatible: existing quote URLs / save-quote flow unchanged

---

## The data model recap

(Already in Phase 02 schema, documented again here for context.)

```sql
create table pricing_versions (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id),
  version_label text not null,
  effective_from timestamptz not null,
  effective_to timestamptz,
  margin_matrix jsonb not null,
  crew_hourly_rate_pence int not null,
  van_hourly_rate_pence int not null,
  pass_through_config jsonb not null,
  complications jsonb not null,
  size_categories jsonb not null,
  distance_bands jsonb not null,
  dynamic_pricing_enabled boolean default false,
  capacity_bands jsonb,
  modulation_sources text[],
  quote_validity_days int default 7,
  notes text,
  created_by_id uuid references users(id),
  created_at timestamptz not null default now()
);
```

Quotes pin to a snapshot:
```sql
alter table quotes add column pricing_version_id uuid not null references pricing_versions(id);
alter table quotes add column pricing_snapshot jsonb not null;  -- full immutable copy
```

`pricing_snapshot` duplicates the version's data into the quote. This makes quotes truly immutable — even if someone hard-deletes a `pricing_versions` row (don't), the quote retains its source.

---

## Pricing engine (TypeScript)

`src/lib/pricing/engine.ts`:

```ts
import { z } from 'zod';

// Schema (mirrors painlessremovals v4.2 final)
export const pricingConfigSchema = z.object({
  version_label: z.string(),
  margin_matrix: z.array(z.array(z.number())).length(5),  // 5x3
  crew_hourly_rate_pence: z.number().int(),
  van_hourly_rate_pence: z.number().int(),
  pass_through_config: z.object({
    fuel_per_mile_pence: z.number().int(),
    insurance_per_job_pence: z.number().int(),
    waste_disposal_fixed_pence: z.number().int().nullable(),
  }),
  complications: z.array(z.object({
    code: z.string(),
    label: z.string(),
    points: z.number().int(),
  })),
  size_categories: z.array(z.object({
    code: z.string(),
    label: z.string(),
    cubic_ft_min: z.number(),
    cubic_ft_max: z.number(),
    crew_size: z.number().int(),
    estimated_hours: z.number(),
  })),
  distance_bands: z.array(z.object({
    code: z.string(),
    miles_min: z.number(),
    miles_max: z.number(),
  })).length(3),
  dynamic_pricing_enabled: z.boolean(),
  capacity_bands: z.array(z.object({
    band: z.enum(['green', 'yellow', 'red']),
    max_utilization: z.number(),
    margin_delta: z.number(),  // -0.05, 0.0, +0.10
  })).optional(),
  modulation_sources: z.array(z.string()).optional(),
  quote_validity_days: z.number().int().default(7),
});

export type PricingConfig = z.infer<typeof pricingConfigSchema>;

// Quote input
export const quoteInputSchema = z.object({
  size_code: z.string(),
  distance_miles: z.number(),
  complications: z.array(z.string()),  // codes
  source: z.string().optional(),
  date: z.string().date().optional(),  // for dynamic pricing lookup
});

export type QuoteInput = z.infer<typeof quoteInputSchema>;

// Quote output
export interface QuoteResult {
  size_label: string;
  estimated_hours: number;
  crew_size: number;
  base_pence: number;
  pass_through_pence: number;
  complications_addition_pence: number;
  margin_pence: number;
  dynamic_modulation_pence: number;
  total_pence: number;
  breakdown: {
    crew_cost: number;
    van_cost: number;
    fuel: number;
    insurance: number;
    waste: number;
    margin_pct: number;
    capacity_band?: 'green' | 'yellow' | 'red';
    margin_modulated: boolean;
  };
  notes: string[];
  requires_survey: boolean;
}

export function calculateQuote(
  config: PricingConfig,
  input: QuoteInput,
  capacityBand?: 'green' | 'yellow' | 'red'
): QuoteResult {
  // 1. Look up size category
  // 2. Look up distance band (matrix column)
  // 3. Look up size index (matrix row)
  // 4. Get base margin from matrix
  // 5. Compute crew cost = crew_size * estimated_hours * crew_hourly_rate
  // 6. Compute van cost = estimated_hours * van_hourly_rate
  // 7. Apply margin to crew + van only (per pricing v4.2 rule)
  // 8. Add pass-through costs at cost (fuel * miles, insurance, waste)
  // 9. Apply complications:
  //    - 0–1 points: no addition
  //    - 2–3 points: +1 hour to estimated_hours
  //    - 4–5 points: +2 hours
  //    - 6+ points: requires_survey = true, return preliminary quote with note
  // 10. If dynamic_pricing_enabled and modulation_sources includes input.source:
  //     - Apply capacity_band margin_delta
  // 11. Apply 65/35 split-day load/unload ratio for time distribution
  // 12. Round to whole pence

  // Implementation: ~150 lines of pure-function TypeScript
  // Tested against painlessremovals existing v4.2 test fixtures
}
```

The engine is **pure**: same input + same config = same output, deterministic, side-effect-free. Trivially testable.

`tests/pricing/v4.2-fixtures.spec.ts` ports the 17 validated Jay scenarios from painlessremovals as test cases. Both repos use the same fixtures. If they diverge, build fails.

---

## KV broadcast on save

When admin saves a new pricing version:

```ts
// src/lib/actions/pricing.ts

'use server';

export async function publishPricing(input: z.infer<typeof pricingConfigSchema>, notes?: string) {
  const user = await requireRole(['admin', 'manager']);
  const validated = pricingConfigSchema.parse(input);
  const supabase = await createServerClient();

  // 1. Close the current active version (set effective_to = now())
  const { data: current } = await supabase
    .from('pricing_versions')
    .select('id')
    .eq('company_id', user.company_id)
    .is('effective_to', null)
    .single();

  if (current) {
    await supabase
      .from('pricing_versions')
      .update({ effective_to: new Date().toISOString() })
      .eq('id', current.id);
  }

  // 2. Insert new active version
  const { data: newVersion, error } = await supabase
    .from('pricing_versions')
    .insert({
      company_id: user.company_id,
      version_label: validated.version_label,
      effective_from: new Date().toISOString(),
      effective_to: null,
      ...validated,
      notes,
      created_by_id: user.id,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  // 3. Broadcast to KV (Cloudflare API since CRM also runs on Workers, can use binding)
  await env.PRICING_KV.put(
    `pricing:current:${user.company_id}`,
    JSON.stringify({
      ...validated,
      version_id: newVersion.id,
      published_at: new Date().toISOString(),
    }),
    { expirationTtl: 60 * 60 * 24 * 365 }  // 1 year (effectively permanent)
  );

  // 4. Trigger painlessremovals rebuild (optional: also serve dynamically from KV)
  if (env.PAINLESSREMOVALS_DEPLOY_HOOK) {
    fetch(env.PAINLESSREMOVALS_DEPLOY_HOOK, { method: 'POST' }).catch(console.error);
  }

  // 5. Notify (audit log handled by trigger)
  return { ok: true, version: newVersion };
}
```

---

## Painlessremovals integration

In `painlessremovals` repo, add `src/lib/pricing/source.ts`:

```ts
// Reads pricing config from Cloudflare KV at request time (with edge cache)
// Falls back to baked-in last-known-good if KV miss

import { env } from 'cloudflare:workers';
import { fallbackConfig } from './fallback';  // last build's KV value, baked in

const COMPANY_ID = '00000000-0000-0000-0000-000000000001';  // Painless

export async function getActivePricingConfig() {
  try {
    const raw = await env.PRICING_KV.get(`pricing:current:${COMPANY_ID}`);
    if (!raw) return fallbackConfig;
    return JSON.parse(raw);
  } catch (err) {
    console.warn('KV read failed, using fallback', err);
    return fallbackConfig;
  }
}
```

The calculator pages (which already run on Workers) read from this. The Astro static build process bakes the fallback (snapshot of KV at build time) so pages render correctly even if KV is briefly unavailable.

A nightly Cloudflare Cron job rebuilds the painlessremovals site to refresh the baked fallback. Optional but recommended.

---

## Quote creation flow

When a quote is generated (calculator submission, manual quote, etc.):

1. Read active `pricing_versions` row from CRM
2. Run `calculateQuote()` with the version's config + customer's input
3. Insert `quotes` row with:
   - `pricing_version_id` = active version's ID
   - `pricing_snapshot` = full JSONB copy
   - `result` = calculation output
   - `valid_until` = now() + version.quote_validity_days

The customer-facing quote PDF (Phase 6) renders from this immutable snapshot.

---

## Webhook handler — calculator → CRM

`src/app/api/webhooks/quote/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyHMAC } from '@/lib/webhooks/hmac';
import { dedupWebhookEvent } from '@/lib/webhooks/dedup';
import { ingestQuote } from '@/lib/jobs/ingest';

const incomingQuoteSchema = z.object({
  event_id: z.string(),  // dedup
  source: z.string(),    // 'calculator', 'callback', 'contact_form'
  customer: z.object({
    full_name: z.string(),
    email: z.string().email(),
    phone: z.string(),
    postcode: z.string(),
  }),
  addresses: z.object({
    from: z.object({ /* full address */ }),
    to: z.object({ /* full address */ }),
  }),
  quote: z.object({
    pricing_version_id: z.string().uuid(),
    size_code: z.string(),
    distance_miles: z.number(),
    complications: z.array(z.string()),
    total_pence: z.number().int(),
    breakdown: z.any(),
  }).optional(),
  attribution: z.object({
    gclid: z.string().nullable(),
    fbclid: z.string().nullable(),
    utm_source: z.string().nullable(),
    utm_medium: z.string().nullable(),
    utm_campaign: z.string().nullable(),
    landing_page: z.string().nullable(),
  }).optional(),
  consent: z.object({
    marketing_email: z.boolean(),
    timestamp: z.string(),
    source_url: z.string(),
    ip: z.string(),
  }),
});

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('X-Webhook-Signature');

  if (!verifyHMAC(body, signature, process.env.CRM_WEBHOOK_SECRET!)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const parsed = incomingQuoteSchema.parse(JSON.parse(body));

  // Idempotent — dedup on event_id
  const isDuplicate = await dedupWebhookEvent(parsed.event_id, 'quote');
  if (isDuplicate) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  const result = await ingestQuote(parsed);
  return NextResponse.json({ ok: true, job_id: result.job_id });
}
```

`ingestQuote()` does the heavy lifting:
1. AI duplicate detection on customer (Phase 4 logic)
2. Find or create customer
3. Find or create addresses (deduped)
4. Create job in `stage='lead'` with assigned rep (round-robin)
5. If quote data is present, create `quotes` row with snapshot
6. Trigger automation rules (Phase 13 fills these in; Phase 5 stub: send "received your quote" email)
7. Server-side mirror tracking (GA4 MP, Meta CAPI) — same `event_id` for dedup
8. Return `{ job_id, customer_id }`

---

## Painlessremovals webhook addition

In `painlessremovals/src/pages/api/save-quote.ts`, add:

```ts
import { sendCrmWebhook } from '@/lib/integrations/crm';

// ... existing logic (Resend, GA4 MP, Meta CAPI) ...

// New: also POST to CRM
await Promise.allSettled([
  // existing mirrors...
  sendCrmWebhook('quote', {
    event_id,  // same id used for GA4 + Meta dedup
    source: 'calculator',
    customer: { full_name, email, phone, postcode },
    addresses: { from, to },
    quote: { pricing_version_id, size_code, distance_miles, complications, total_pence, breakdown },
    attribution: { gclid, fbclid, utm_source, utm_medium, utm_campaign, landing_page },
    consent: { marketing_email, timestamp, source_url, ip },
  }),
]);
```

`sendCrmWebhook()` adds the HMAC header, retries on 5xx (3 attempts), surfaces error to Sentry but never blocks the user-facing flow.

Same pattern for `/api/contact.ts`, `/api/callbacks.ts`, `/api/clearance-callback.ts`, `/api/affiliate.ts`, `/api/partner-register.ts`.

---

## Acceptance criteria

- [ ] Admin can edit pricing config in `/dashboard/settings/pricing` with all fields
- [ ] Save creates new `pricing_versions` row, closes the previous
- [ ] Save writes to `PRICING_KV` within 1 second
- [ ] Painlessremovals calculator on next page load (or up to 60s) reflects new pricing
- [ ] Pricing simulator: input scenario, see breakdown matching expected v4.2 output
- [ ] All 17 Jay v4.2 test fixtures pass in CRM engine and painlessremovals engine
- [ ] Webhook receives quote from calculator, creates job + customer + quote in CRM
- [ ] Duplicate event_id is idempotent (no double-create)
- [ ] HMAC failure returns 401, logged
- [ ] Quote snapshot stored on `quotes` row is immutable (verify after pricing change)
- [ ] Existing painlessremovals quote URLs continue to work unchanged

---

## Files created (CRM)

```
src/
├── app/
│   ├── dashboard/settings/pricing/
│   │   ├── page.tsx (history list)
│   │   ├── edit/page.tsx (form)
│   │   └── simulator/page.tsx
│   └── api/webhooks/
│       ├── quote/route.ts
│       ├── contact/route.ts
│       ├── callback/route.ts
│       ├── affiliate/route.ts
│       ├── clearance-callback/route.ts
│       └── partner-register/route.ts
├── lib/
│   ├── actions/pricing.ts
│   ├── pricing/engine.ts
│   ├── pricing/fixtures.ts (test fixtures, shared with painlessremovals)
│   ├── jobs/ingest.ts
│   └── webhooks/{hmac,dedup}.ts
tests/
└── pricing/v4.2-fixtures.spec.ts
```

## Files modified (painlessremovals)

```
src/
├── lib/
│   ├── pricing/source.ts (NEW: KV read)
│   ├── pricing/fallback.ts (NEW: build-time bake)
│   └── integrations/crm.ts (NEW: webhook sender with HMAC + retry)
└── pages/api/
    ├── save-quote.ts (modified: add CRM webhook to Promise.allSettled)
    ├── contact.ts (modified)
    ├── callbacks.ts (modified)
    ├── clearance-callback.ts (modified)
    ├── affiliate.ts (modified)
    └── partner-register.ts (modified)
```

---

## Risk register

| Risk | Mitigation |
|---|---|
| KV write latency causes save to feel slow | KV write is fire-and-forget; UI shows "saved, propagating" state for 60s |
| Calculator and CRM engine drift | Shared test fixtures fail build if outputs differ |
| HMAC secret leak | Rotate via Wrangler secrets; webhooks reject old key after grace period |
| Webhook handler is the bottleneck on lead spike | Workers scale automatically; Supabase has connection pooling on Pro |

---

## Out of scope

- Manual quote builder UI (Phase 6)
- Customer-facing quote acceptance flow (Phase 6)
- Capacity-aware dynamic pricing (Phase 7) — this phase ships the fields but `dynamic_pricing_enabled = false` until Phase 7
- A/B testing of pricing variants (post-1.0)
