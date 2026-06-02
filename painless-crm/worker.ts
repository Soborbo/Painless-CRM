// Custom Worker entry that adds a Cloudflare Cron `scheduled` handler on top of
// the OpenNext-generated fetch worker. It wraps the generated default export and
// re-exports the same Durable Object classes the generated worker does (required
// so wrangler can find them).
//
// NOT YET WIRED: this becomes the Worker entry only once the OpenNext Cloudflare
// pipeline is initialized. To activate cron firing:
//   1. `pnpm exec opennextjs-cloudflare migrate`  → creates open-next.config.ts
//      (+ patches next.config.ts). NOTE: OpenNext build is unsupported on native
//      Windows — run the build/deploy from WSL or CI.
//   2. In wrangler.toml set `main = "worker.ts"` (currently ".open-next/worker.js").
//   3. Confirm the three DO re-export paths below match the generated
//      .open-next/worker.js (they mirror the OpenNext worker template).
//   4. Set the secrets (CRM_WEBHOOK_SECRET, etc.) and verify on `pnpm preview`.
// Until then the [triggers] in wrangler.toml fire scheduled() on the generated
// worker, which has no scheduled handler — a harmless no-op.

// @ts-expect-error — resolved by wrangler/esbuild at build time.
import openNextWorker from './.open-next/worker.js';
import { prepareCronDispatch } from './src/worker-cron/dispatch';

// @ts-expect-error — resolved by wrangler/esbuild at build time.
export { DOQueueHandler } from './.open-next/.build/durable-objects/queue.js';
// @ts-expect-error — resolved by wrangler/esbuild at build time.
export { DOShardedTagCache } from './.open-next/.build/durable-objects/sharded-tag-cache.js';
// @ts-expect-error — resolved by wrangler/esbuild at build time.
export { BucketCachePurge } from './.open-next/.build/durable-objects/bucket-cache-purge.js';

interface CronEnv {
  CRM_WEBHOOK_SECRET?: string;
  NEXT_PUBLIC_APP_URL?: string;
}

interface ScheduledEvent {
  cron: string;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

export default {
  ...openNextWorker,
  async scheduled(event: ScheduledEvent, env: CronEnv, ctx: ExecutionContext): Promise<void> {
    const dispatch = await prepareCronDispatch(event.cron, env);
    if (dispatch.kind === 'skip') {
      if (dispatch.reason === 'no_secret') {
        console.warn('[cron] CRM_WEBHOOK_SECRET unset — skipping %s', event.cron);
      }
      return;
    }
    ctx.waitUntil(
      fetch(dispatch.url, {
        method: 'POST',
        headers: { 'x-cron-signature': dispatch.signature },
        body: '',
      })
        .then((res) => {
          if (!res.ok) console.error('[cron] %s -> %d', dispatch.url, res.status);
        })
        .catch((err) => console.error('[cron] %s failed: %o', dispatch.url, err)),
    );
  },
};
