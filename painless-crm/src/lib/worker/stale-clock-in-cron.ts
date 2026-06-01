import { createAdminClient } from '@/lib/supabase/admin';
import { STALE_HOURS, type TimeEntryInput, findStaleClockIns } from '@/lib/worker/stale-clock-in';

// Hourly sweep (Phase 09 ADR-011 mandate #4): find workers with an active
// clock-in older than 6h and no closing entry since, so they can be nudged to
// open the app and sync. Runs without a user → service-role client, scopes
// nothing by RLS. Pulls a bounded recent window so the scan stays cheap.
//
// NOTE: web-push delivery is a later Phase 09 slice (no push infra wired yet).
// This returns the detected stale clock-ins; the route reports the count.

const LOOKBACK_HOURS = 48;
const MAX_ENTRIES = 5000;

export interface StaleSweepResult {
  scanned: number;
  stale: number;
  workers: string[];
}

export async function runStaleClockInSweep(now: Date = new Date()): Promise<StaleSweepResult> {
  const supabase = createAdminClient();
  const sinceIso = new Date(now.getTime() - LOOKBACK_HOURS * 3_600_000).toISOString();

  const { data } = await supabase
    .from('time_entries')
    .select('worker_id, job_id, type, occurred_at')
    .is('deleted_at', null)
    .gte('occurred_at', sinceIso)
    .order('occurred_at', { ascending: true })
    .limit(MAX_ENTRIES);

  const entries = (data ?? []) as TimeEntryInput[];
  const stale = findStaleClockIns(entries, now, STALE_HOURS);

  return {
    scanned: entries.length,
    stale: stale.length,
    workers: [...new Set(stale.map((s) => s.worker_id))],
  };
}
