// Availability broadcast to Cloudflare KV. Phase 07 §2.
//
// The CRM is the writer; painlessremovals reads `availability:{company}:{week}`
// (+ an `:index` key) on every public-calendar render. Mirrors lib/kv/pricing.ts:
// graceful degrade when the binding is absent (e.g. `next dev`, tests), so a
// missing KV never breaks the override flow. Only bands are published — no
// customer data ever lands in KV (PII rule).

import type { AvailabilityWeek } from '@/lib/capacity/iso-week';

export const AVAILABILITY_KV_TTL_SECONDS = 60 * 60 * 24 * 60; // 60 days

export function availabilityWeekKey(companyId: string, week: string): string {
  return `availability:${companyId}:${week}`;
}

export function availabilityIndexKey(companyId: string): string {
  return `availability:${companyId}:index`;
}

interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

interface CloudflareEnv {
  AVAILABILITY_KV?: KVNamespace;
}

async function getAvailabilityKV(): Promise<KVNamespace | null> {
  try {
    const mod = (await import('@opennextjs/cloudflare')) as {
      getCloudflareContext?: (opts: { async: boolean }) => Promise<{ env?: CloudflareEnv }>;
    };
    if (!mod.getCloudflareContext) return null;
    const ctx = await mod.getCloudflareContext({ async: true });
    return ctx?.env?.AVAILABILITY_KV ?? null;
  } catch {
    return null;
  }
}

export interface WriteAvailabilityResult {
  ok: boolean;
  reason?: string;
  weeksWritten: number;
}

// Testable core: pure aside from the injected KV. Writes one key per week plus
// the index. `nowIso` stamps published_at (passed in so this stays testable).
export async function writeAvailabilityWith(
  kv: KVNamespace | null,
  companyId: string,
  weeks: readonly AvailabilityWeek[],
  nowIso: string,
): Promise<WriteAvailabilityResult> {
  if (!kv) return { ok: false, reason: 'AVAILABILITY_KV binding unavailable', weeksWritten: 0 };

  for (const week of weeks) {
    await kv.put(
      availabilityWeekKey(companyId, week.week),
      JSON.stringify({ week: week.week, days: week.days, published_at: nowIso }),
      { expirationTtl: AVAILABILITY_KV_TTL_SECONDS },
    );
  }
  await kv.put(
    availabilityIndexKey(companyId),
    JSON.stringify({ weeks: weeks.map((w) => w.week), published_at: nowIso }),
    { expirationTtl: AVAILABILITY_KV_TTL_SECONDS },
  );
  return { ok: true, weeksWritten: weeks.length };
}

export async function writeAvailability(
  companyId: string,
  weeks: readonly AvailabilityWeek[],
  nowIso: string,
): Promise<WriteAvailabilityResult> {
  const kv = await getAvailabilityKV();
  return writeAvailabilityWith(kv, companyId, weeks, nowIso);
}
