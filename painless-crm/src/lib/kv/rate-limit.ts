// Fixed-window rate limiter backed by Cloudflare KV.
//
// SECURITY_MODEL.md Gate 5 (webhook overflow) and T4 (insider bulk-export)
// both call for `rateLimitCheck(key, { windowSec, maxRequests })`. This is
// the single implementation. It degrades gracefully: when no KV binding is
// present (local dev, tests) the call is allowed and flagged `degraded`, so
// a missing namespace never hard-blocks a legitimate request — exactly the
// stance lib/kv/pricing.ts takes on a KV miss.
//
// The window is bucketed by `floor(now / window)` so each bucket key self-
// expires and a new window starts clean. KV has no atomic increment, so a
// burst racing on the same bucket can slip a few requests over the limit;
// that is acceptable at v0.1 scale (full DLP is post-v1 per SECURITY_MODEL).

export interface RateLimitOptions {
  windowSec: number;
  maxRequests: number;
}

export interface RateLimitResult {
  ok: boolean;
  limit: number;
  remaining: number;
  /** true when no KV namespace was available and the check was skipped. */
  degraded: boolean;
}

interface RateLimitKV {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

interface CloudflareEnv {
  RATE_LIMIT_KV?: RateLimitKV;
}

async function getRateLimitKV(): Promise<RateLimitKV | null> {
  try {
    const mod = (await import('@opennextjs/cloudflare')) as {
      getCloudflareContext?: (opts: { async: boolean }) => Promise<{ env?: CloudflareEnv }>;
    };
    if (!mod.getCloudflareContext) return null;
    const ctx = await mod.getCloudflareContext({ async: true });
    return ctx?.env?.RATE_LIMIT_KV ?? null;
  } catch {
    return null;
  }
}

export function rateLimitWindowKey(key: string, windowSec: number, nowMs: number): string {
  const bucket = Math.floor(nowMs / (windowSec * 1000));
  return `rl:${key}:${bucket}`;
}

function parseCount(raw: string | null): number {
  if (raw === null) return 0;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

// Testable core: pure aside from the injected KV. The route-facing
// `rateLimitCheck` resolves the KV binding and the clock for you.
export async function checkRateLimitWith(
  kv: RateLimitKV | null,
  key: string,
  options: RateLimitOptions,
  nowMs: number,
): Promise<RateLimitResult> {
  const { windowSec, maxRequests } = options;
  if (!kv) {
    return { ok: true, limit: maxRequests, remaining: maxRequests, degraded: true };
  }

  const bucketKey = rateLimitWindowKey(key, windowSec, nowMs);
  const count = parseCount(await kv.get(bucketKey));

  if (count >= maxRequests) {
    return { ok: false, limit: maxRequests, remaining: 0, degraded: false };
  }

  await kv.put(bucketKey, String(count + 1), { expirationTtl: windowSec });
  return { ok: true, limit: maxRequests, remaining: maxRequests - (count + 1), degraded: false };
}

export async function rateLimitCheck(
  key: string,
  options: RateLimitOptions,
): Promise<RateLimitResult> {
  const kv = await getRateLimitKV();
  return checkRateLimitWith(kv, key, options, Date.now());
}
