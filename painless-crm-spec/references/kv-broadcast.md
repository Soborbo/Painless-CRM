# Cloudflare KV Broadcast Pattern

This document defines how the CRM publishes pricing config and capacity data to Cloudflare KV, which the public painlessremovals.com site reads at request time. KV is the **edge replication layer** between the two repos.

## Why KV (and not Supabase direct)?

Painlessremovals reads pricing and availability on every page render. Going to Supabase from Cloudflare Workers adds 30–80ms latency per read. KV has 5–10ms read latency at the edge and is purpose-built for this kind of small-config-broadcast workload.

The CRM remains the source of truth in Postgres. KV is a cache/broadcast layer with the CRM as publisher.

---

## Topology

```
                 ┌─────────────────┐
                 │   CRM (writes)  │
                 │                 │
                 │  Postgres       │
                 │  pricing_versions
                 │  capacity_overrides
                 └────────┬────────┘
                          │
                          │ on save
                          ▼
                 ┌─────────────────┐
                 │ Cloudflare KV   │
                 │                 │
                 │ pricing:current:{company_id}
                 │ pricing:v4.2:{company_id}
                 │ availability:{company_id}:{YYYY-WW}
                 └────────┬────────┘
                          │
                          │ on read (hot path)
                          ▼
                 ┌─────────────────┐
                 │ painlessremovals│
                 │                 │
                 │ /instantquote/* │
                 │ /availability   │
                 └─────────────────┘
```

---

## Key naming conventions

```
pricing:current:{company_id}
pricing:{version_label}:{company_id}      # historical (kept for ~30 days)
availability:{company_id}:{YYYY-WW}       # 6-week rolling window
config:feature_flags:{company_id}         # public-readable feature flags only
```

Notes:
- All keys include `company_id` for multi-tenant safety. Painlessremovals reads `00000000-0000-0000-0000-000000000001` exclusively.
- ISO week format `YYYY-WW` for availability (e.g., `2026-W19`).
- No PII in any KV value, ever.

---

## Write pattern (CRM)

```ts
// src/lib/kv/pricing.ts

import { env } from 'cloudflare:workers';

export async function publishPricingToKV(
  companyId: string,
  versionId: string,
  config: PricingConfig
) {
  const payload = {
    ...config,
    version_id: versionId,
    published_at: new Date().toISOString(),
  };

  // Write current pointer
  await env.PRICING_KV.put(
    `pricing:current:${companyId}`,
    JSON.stringify(payload),
    { expirationTtl: 60 * 60 * 24 * 365 }  // 1 year
  );

  // Write version-keyed copy (audit trail at KV level)
  await env.PRICING_KV.put(
    `pricing:${config.version_label}:${companyId}`,
    JSON.stringify(payload),
    { expirationTtl: 60 * 60 * 24 * 30 }   // 30 days
  );

  // Trigger painlessremovals deploy hook (optional — KV is read at request time anyway)
  if (env.PAINLESSREMOVALS_DEPLOY_HOOK) {
    fetch(env.PAINLESSREMOVALS_DEPLOY_HOOK, { method: 'POST' }).catch(console.error);
  }
}
```

```ts
// src/lib/kv/availability.ts

export async function publishAvailabilityToKV(
  companyId: string,
  weeks: Array<{ week: string; days: Record<string, 'green' | 'yellow' | 'red' | 'closed'> }>
) {
  // Write each week as its own key (so painlessremovals can fetch only what it needs)
  for (const week of weeks) {
    await env.AVAILABILITY_KV.put(
      `availability:${companyId}:${week.week}`,
      JSON.stringify({
        week: week.week,
        days: week.days,
        published_at: new Date().toISOString(),
      }),
      { expirationTtl: 60 * 60 * 24 * 60 }  // 60 days
    );
  }

  // Index key: list of currently-published weeks
  await env.AVAILABILITY_KV.put(
    `availability:${companyId}:index`,
    JSON.stringify({
      weeks: weeks.map(w => w.week),
      published_at: new Date().toISOString(),
    }),
    { expirationTtl: 60 * 60 * 24 * 60 }
  );
}
```

---

## Read pattern (painlessremovals)

```ts
// painlessremovals/src/lib/pricing/source.ts

import { env } from 'cloudflare:workers';
import { fallbackConfig } from './fallback';

const PAINLESS_COMPANY_ID = '00000000-0000-0000-0000-000000000001';

export async function getActivePricingConfig() {
  try {
    const raw = await env.PRICING_KV.get(`pricing:current:${PAINLESS_COMPANY_ID}`);
    if (!raw) {
      console.warn('Pricing KV miss, using fallback');
      return fallbackConfig;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error('Pricing KV read error', err);
    return fallbackConfig;
  }
}
```

```ts
// painlessremovals/src/lib/availability/source.ts

export async function getAvailabilityWeek(week: string) {
  try {
    const raw = await env.AVAILABILITY_KV.get(`availability:${PAINLESS_COMPANY_ID}:${week}`);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

export async function getAvailabilityCalendar(weeksAhead = 6) {
  const today = new Date();
  const weeks: string[] = [];
  for (let i = 0; i < weeksAhead; i++) {
    const d = new Date(today.getTime() + i * 7 * 24 * 60 * 60 * 1000);
    weeks.push(toIsoWeek(d));  // 'YYYY-WW'
  }
  const results = await Promise.all(weeks.map(w => getAvailabilityWeek(w)));
  return results.filter(Boolean);
}
```

---

## Fallback pattern

painlessremovals must render correctly even if KV is briefly unreachable. We bake a known-good copy at build time:

```ts
// painlessremovals/src/lib/pricing/fallback.ts

// This file is auto-generated at build time by scripts/snapshot-pricing.ts
// It reads from KV (or the CRM API as fallback) and writes a TypeScript constant.

export const fallbackConfig: PricingConfig = {
  version_label: 'v4.2-snapshot-2026-05-02',
  // ... full config baked in
};
```

A nightly Cloudflare Cron in painlessremovals rebuilds the site to refresh the snapshot. This means:
- If KV is up: live config served from KV (always fresh)
- If KV is down: snapshot from build time served (max 24h stale)
- If both fail: hardcoded ultra-fallback (last-known-safe values)

---

## Manual operations

### View current pricing

```bash
wrangler kv:key get --binding=PRICING_KV "pricing:current:00000000-0000-0000-0000-000000000001"
```

### List all keys

```bash
wrangler kv:key list --binding=PRICING_KV --prefix "pricing:"
```

### Manually update (emergency only — should always go through CRM admin UI)

```bash
wrangler kv:key put --binding=PRICING_KV "pricing:current:00000000-0000-0000-0000-000000000001" "$(cat hotfix-pricing.json)"
```

If you do this, immediately reflect it in the database (`pricing_versions` row) so the next legitimate save doesn't overwrite the hotfix with stale data.

---

## Costs

Cloudflare Workers Paid plan includes:
- 10M KV reads / month (we use ~10K — calculator pageviews)
- 1M KV writes / month (we use ~10/month — pricing changes are rare)

KV is essentially free for this use case. No need to optimize.

---

## What KV is NOT for

- Customer data (use Postgres)
- Quote storage (use Postgres)
- Session data (use Supabase Auth)
- Anything mutable from the public side (KV writes from painlessremovals would invert the source-of-truth direction)

Rule of thumb: KV is one-way (CRM publishes, painlessremovals consumes). If you find yourself wanting to write to KV from painlessremovals, redesign.
