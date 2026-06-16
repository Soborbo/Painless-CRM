import { serverEnv } from '@/lib/env';
import { TamarCdrListSchema, type TamarCdr } from './cdr';

// Thin client over Tamar's Call Stats API (CDRs). Pull-based — there is no
// inbound webhook — so the poll cron calls listCdrs() per number per window.
// Auth is HTTP Basic: base64(login:token) (Tamar API manual). Degrades to a
// typed no-op without the creds (mirrors sendAutomationEmail). Non-OAuth creds
// live in env per ADR-009 / rule 16.

const DEFAULT_BASE = 'https://api.tamar.co.uk';

export type ListCdrsResult =
  | { ok: true; cdrs: TamarCdr[] }
  | { ok: false; reason: 'no_api_key' | 'request_failed' | 'bad_response'; error?: string };

export interface ListCdrsParams {
  number: string;
  /** Tamar wants UK dates: dd/mm/yyyy (see formatTamarDate in poll.ts). */
  start: string;
  end: string;
}

function basicAuth(login: string, token: string): string {
  // btoa is available in the Workers/Edge runtime this deploys to.
  return `Basic ${btoa(`${login}:${token}`)}`;
}

export async function listCdrs(params: ListCdrsParams): Promise<ListCdrsResult> {
  const env = serverEnv();
  if (!env.TAMAR_API_LOGIN || !env.TAMAR_API_TOKEN) {
    console.warn('[tamar] credentials missing — skipping CDR fetch for %s', params.number);
    return { ok: false, reason: 'no_api_key' };
  }
  const base = (env.TAMAR_API_BASE ?? DEFAULT_BASE).replace(/\/$/, '');
  const url = new URL(`${base}/cdrs/`);
  url.searchParams.set('number', params.number);
  url.searchParams.set('start', params.start);
  url.searchParams.set('end', params.end);

  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        Authorization: basicAuth(env.TAMAR_API_LOGIN, env.TAMAR_API_TOKEN),
        Accept: 'application/json',
      },
    });
  } catch (err) {
    return {
      ok: false,
      reason: 'request_failed',
      error: err instanceof Error ? err.message.slice(0, 200) : 'fetch_error',
    };
  }
  // Diagnostic (temporary): the exact URL queried (shows the number format sent)
  // + the HTTP status, so we can tell auth (401) from an empty result.
  console.log('[tamar] GET', url.toString(), '->', res.status);
  if (!res.ok) {
    return { ok: false, reason: 'request_failed', error: `http_${res.status}` };
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return { ok: false, reason: 'bad_response', error: 'invalid_json' };
  }
  // Tamar returns { cdr: [...], summary: {...} }. Tolerate a couple of common
  // envelope shapes too in case of API drift.
  const obj = body as Record<string, unknown> | null;
  const candidate = Array.isArray(body)
    ? body
    : (obj?.cdr ?? obj?.cdrs ?? obj?.data ?? obj?.results);
  const parsed = TamarCdrListSchema.safeParse(candidate);
  if (!parsed.success) {
    return { ok: false, reason: 'bad_response', error: 'unexpected_shape' };
  }
  return { ok: true, cdrs: parsed.data };
}
