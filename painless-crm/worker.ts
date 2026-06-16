// Custom Worker entry that adds a Cloudflare Cron `scheduled` handler on top of
// the OpenNext-generated fetch worker. It wraps the generated default export
// (`fetch`) and adds `scheduled`, which dispatches each firing cron expression
// to its HMAC-guarded /api/cron/* route (see worker-cron/dispatch.ts).
//
// This IS the Worker entry: wrangler.toml `main = "worker.ts"`. The OpenNext
// build (`opennextjs-cloudflare build`, run in CI — unsupported on native
// Windows) produces ./.open-next/worker.js, which esbuild resolves at deploy.
//
// No Durable Object re-exports: open-next.config.ts is defineCloudflareConfig({})
// (in-worker caching, no DO queue/cache) and wrangler.toml declares no DO
// bindings, so the empty-config build emits no durable-objects to re-export. Add
// them back here (matching the generated worker) only if a future config enables
// the OpenNext DO cache/queue together with their wrangler bindings.

// @ts-expect-error — resolved by wrangler/esbuild at build time.
import openNextWorker from './.open-next/worker.js';
import { prepareCronDispatch } from './src/worker-cron/dispatch';

interface CronEnv {
  CRM_WEBHOOK_SECRET?: string;
  NEXT_PUBLIC_APP_URL?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
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
    // TEMP DIAGNOSTIC: prove scheduled() fires + capture the exact cron string
    // Cloudflare passes (vs CRON_SCHEDULE keys). Direct Supabase REST insert so
    // it does not depend on the self-fetch / route. Remove after diagnosis.
    if (env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
      ctx.waitUntil(
        fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/tamar_poll_diag`, {
          method: 'POST',
          headers: {
            apikey: env.SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({ result: { marker: 'scheduled-fired', cron: event.cron } }),
        }).catch(() => {}),
      );
    }
    const dispatch = await prepareCronDispatch(event.cron, env, Date.now());
    if (dispatch.kind === 'skip') {
      if (dispatch.reason === 'no_secret') {
        console.warn('[cron] CRM_WEBHOOK_SECRET unset — skipping %s', event.cron);
      }
      return;
    }
    ctx.waitUntil(
      fetch(dispatch.url, {
        method: 'POST',
        headers: {
          'x-cron-signature': dispatch.signature,
          'x-cron-timestamp': dispatch.timestamp,
        },
        body: '',
      })
        .then((res) => {
          if (!res.ok) console.error('[cron] %s -> %d', dispatch.url, res.status);
        })
        .catch((err) => console.error('[cron] %s failed: %o', dispatch.url, err)),
    );
  },
};
