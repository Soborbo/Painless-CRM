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
}

interface OpenNextWorker {
  fetch: (req: Request, env: unknown, ctx: ExecutionContext) => Response | Promise<Response>;
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
    const dispatch = await prepareCronDispatch(event.cron, env, Date.now());
    if (dispatch.kind === 'skip') {
      if (dispatch.reason === 'no_secret') {
        console.warn('[cron] CRM_WEBHOOK_SECRET unset — skipping %s', event.cron);
      }
      return;
    }
    // Invoke the cron route IN-PROCESS via the OpenNext fetch handler. A plain
    // fetch() to our own public hostname does NOT loop back to this Worker
    // (Cloudflare self-fetch), so the route never ran and every cron was a silent
    // no-op. Calling the handler directly runs the Next.js route in this isolate
    // (OpenNext populates process.env from env); the HMAC headers still auth it.
    const req = new Request(dispatch.url, {
      method: 'POST',
      headers: {
        'x-cron-signature': dispatch.signature,
        'x-cron-timestamp': dispatch.timestamp,
      },
    });
    ctx.waitUntil(
      Promise.resolve((openNextWorker as OpenNextWorker).fetch(req, env, ctx))
        .then((res) => {
          if (!res.ok) console.error('[cron] %s -> %d', dispatch.url, res.status);
        })
        .catch((err: unknown) => console.error('[cron] %s failed: %o', dispatch.url, err)),
    );
  },
};
