// Cron dispatch table + HMAC signer for the Worker `scheduled` handler.
//
// Cloudflare Cron Triggers fire the Worker's `scheduled(event)` with
// `event.cron` set to the matching crontab expression. Our cron work lives in
// HMAC-protected HTTP routes under /api/cron/*, so the scheduled handler maps
// the firing expression to its endpoint, signs the fixed payload string with
// CRM_WEBHOOK_SECRET, and POSTs it. The signature scheme here MUST match
// lib/webhooks/handler.verifyHmac (hex HMAC-SHA256 over the payload string).
//
// This module is pure (no Worker globals beyond Web Crypto), so it is unit
// tested; the wrapper in worker.ts is the only Cloudflare-specific glue.

export interface CronJob {
  /** API route the scheduled trigger should POST to. */
  path: string;
  /** Fixed payload string the route's HMAC is computed over (its CRON_PAYLOAD). */
  payload: string;
}

// Keys are the exact crontab expressions declared under [triggers] in
// wrangler.toml. Keep the two in lockstep.
export const CRON_SCHEDULE: Record<string, CronJob> = {
  '0 1 * * *': { path: '/api/cron/recompute-availability', payload: 'recompute-availability' },
  '0 2 * * *': { path: '/api/cron/expire-quotes', payload: 'expire-quotes' },
  '0 6 * * *': { path: '/api/cron/vehicle-compliance', payload: 'vehicle-compliance' },
  '30 6 * * *': { path: '/api/cron/complaint-sla', payload: 'complaint-sla' },
  '0 9 * * *': { path: '/api/cron/sla-digest', payload: 'sla-digest' },
  '45 6 * * *': { path: '/api/cron/invoice-dunning', payload: 'invoice-dunning' },
  '15 * * * *': { path: '/api/cron/review-requests', payload: 'review-requests' },
  '* * * * *': { path: '/api/cron/automation-queue', payload: 'automation-queue' },
  '*/30 * * * *': { path: '/api/cron/stale-clock-in', payload: 'stale-clock-in' },
  '0 7 * * 1': { path: '/api/cron/weekly-digest', payload: 'weekly-digest' },
};

export function resolveCronJob(cron: string): CronJob | null {
  return CRON_SCHEDULE[cron] ?? null;
}

// Hex HMAC-SHA256, identical to lib/webhooks/handler.computeHmacSha256Hex so the
// route's verifyHmac accepts it.
export async function signCronPayload(secret: string, payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
