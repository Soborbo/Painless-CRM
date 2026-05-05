// Single source of truth for pricing reads from Cloudflare KV.
// Per CLAUDE.md, this file is locked: do not edit without an ADR / spec PR.
//
// The CRM is the writer (Server Actions in lib/actions/pricing.ts) and every
// quote-generating surface — the manual quote builder, painlessremovals
// calculator, public availability page — reads from this helper. KV broadcast
// is fire-and-forget after the Postgres write commits, so it never blocks the
// admin save UX. A KV miss falls back to a deterministic null which callers
// must turn into "use the latest pricing_versions row" — this keeps quotes
// strictly anchored to Postgres while KV is just the fast public broadcast.

import { type PricingConfig, PricingConfigSchema } from '@/lib/schemas/pricing';

export const PRICING_KV_TTL_SECONDS = 60 * 60 * 24 * 365;

export interface BroadcastedPricing {
  config: PricingConfig;
  version_id: string;
  published_at: string;
}

export function pricingKVKey(companyId: string): string {
  return `pricing:current:${companyId}`;
}

interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

interface CloudflareEnv {
  PRICING_KV?: KVNamespace;
}

async function getCloudflareEnv(): Promise<CloudflareEnv | null> {
  try {
    const mod = (await import('@opennextjs/cloudflare')) as {
      getCloudflareContext?: (opts: { async: boolean }) => Promise<{
        env?: CloudflareEnv;
      }>;
    };
    if (!mod.getCloudflareContext) return null;
    const ctx = await mod.getCloudflareContext({ async: true });
    return ctx?.env ?? null;
  } catch {
    return null;
  }
}

export async function readBroadcastedPricing(
  companyId: string,
): Promise<BroadcastedPricing | null> {
  const env = await getCloudflareEnv();
  if (!env?.PRICING_KV) return null;

  const raw = await env.PRICING_KV.get(pricingKVKey(companyId));
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as {
      config?: unknown;
      version_id?: string;
      published_at?: string;
    };
    if (!parsed.version_id || !parsed.published_at) return null;
    const config = PricingConfigSchema.parse(parsed.config);
    return { config, version_id: parsed.version_id, published_at: parsed.published_at };
  } catch {
    return null;
  }
}

export async function writeBroadcastedPricing(
  companyId: string,
  payload: BroadcastedPricing,
): Promise<{ ok: boolean; reason?: string }> {
  const env = await getCloudflareEnv();
  if (!env?.PRICING_KV) {
    return { ok: false, reason: 'PRICING_KV binding unavailable' };
  }
  await env.PRICING_KV.put(pricingKVKey(companyId), JSON.stringify(payload), {
    expirationTtl: PRICING_KV_TTL_SECONDS,
  });
  return { ok: true };
}
