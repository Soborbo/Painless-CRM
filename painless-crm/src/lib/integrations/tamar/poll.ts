import { serverEnv } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/admin';
import { listCdrs } from './client';
import { ingestTamarCdrs, type IngestResult } from './ingest';
import { parseTamarNumbers } from './numbers';

// Orchestrates one poll cycle: for each of our Tamar numbers, fetch the CDRs for
// today (+ yesterday, to span the midnight boundary) and ingest them. Tamar
// filters by DATE only (dd/mm/yyyy), so every run re-fetches the whole day; the
// upsert on external_id makes that idempotent and the "seen" set makes the
// missed-call notification fire once. Degrades to a typed no-op when creds or
// tenant config are absent.

export type PollResult =
  | { ok: false; reason: 'no_api_key' | 'no_numbers' | 'no_company' }
  | {
      ok: true;
      numbers: number;
      fetched: number;
      ingest: IngestResult;
      errors: string[];
    };

/** UK date dd/mm/yyyy in UTC — what Tamar's start/end params expect. Pure. */
export function formatTamarDate(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = d.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export async function runTamarPoll(now: Date = new Date()): Promise<PollResult> {
  const env = serverEnv();
  if (!env.TAMAR_API_LOGIN || !env.TAMAR_API_TOKEN) return { ok: false, reason: 'no_api_key' };

  const ourNumbers = parseTamarNumbers(env.TAMAR_NUMBERS);
  if (ourNumbers.length === 0) return { ok: false, reason: 'no_numbers' };

  const companyId = env.WEBHOOK_COMPANY_ID;
  if (!companyId) return { ok: false, reason: 'no_company' };

  const end = formatTamarDate(now);
  const start = formatTamarDate(new Date(now.getTime() - 24 * 60 * 60_000));

  const supabase = createAdminClient();
  const errors: string[] = [];
  let fetched = 0;
  const totals: IngestResult = {
    mapped: 0,
    skipped: 0,
    upserted: 0,
    matchedCustomer: 0,
    matchedJob: 0,
    missedNotified: 0,
  };

  for (const number of ourNumbers) {
    const res = await listCdrs({ number, start, end });
    if (!res.ok) {
      errors.push(`${number}: ${res.reason}${res.error ? ` (${res.error})` : ''}`);
      continue;
    }
    fetched += res.cdrs.length;
    const r = await ingestTamarCdrs(supabase, { companyId, ourNumbers, cdrs: res.cdrs });
    totals.mapped += r.mapped;
    totals.skipped += r.skipped;
    totals.upserted += r.upserted;
    totals.matchedCustomer += r.matchedCustomer;
    totals.matchedJob += r.matchedJob;
    totals.missedNotified += r.missedNotified;
  }

  return { ok: true, numbers: ourNumbers.length, fetched, ingest: totals, errors };
}
