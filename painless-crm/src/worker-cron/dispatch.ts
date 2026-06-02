// Pure decision layer for the Worker `scheduled` handler. Given a firing cron
// expression + env, it resolves the target /api/cron route and produces the
// signed request to POST. Kept separate from worker.ts (which imports the
// generated .open-next bundle and so can't be unit-tested) so the dispatch
// logic — route resolution, secret gating, URL building, HMAC signing — is
// testable in isolation. worker.ts just performs the fetch the result describes.

import { resolveCronJob, signCronPayload } from './schedule';

export interface CronDispatchEnv {
  CRM_WEBHOOK_SECRET?: string;
  NEXT_PUBLIC_APP_URL?: string;
}

export type CronDispatch =
  | { kind: 'skip'; reason: 'unknown_cron' | 'no_secret' }
  | { kind: 'dispatch'; url: string; signature: string };

const DEFAULT_BASE = 'https://crm.painlessremovals.com';

export async function prepareCronDispatch(
  cron: string,
  env: CronDispatchEnv,
): Promise<CronDispatch> {
  const job = resolveCronJob(cron);
  if (!job) return { kind: 'skip', reason: 'unknown_cron' };

  const secret = env.CRM_WEBHOOK_SECRET;
  if (!secret) return { kind: 'skip', reason: 'no_secret' };

  const base = (env.NEXT_PUBLIC_APP_URL ?? DEFAULT_BASE).replace(/\/$/, '');
  const signature = await signCronPayload(secret, job.payload);
  return { kind: 'dispatch', url: `${base}${job.path}`, signature };
}
