// Phase 09 §stale clock-in detection. Pure: find workers who clocked in more
// than STALE_HOURS ago without any closing time entry since. The hourly cron
// feeds it the recent time entries; for each match it pushes "we haven't
// received your data" (ADR-011 mandate #4). Pure so the rule is unit-tested.

export const STALE_HOURS = 6;

// Entry types that count as "the job is progressing / done" — their presence
// after a clock-in means the worker's data is flowing, so not stale.
const CLOSING_TYPES = new Set(['clock_out', 'load_end', 'unload_end']);

export interface TimeEntryInput {
  worker_id: string;
  job_id: string;
  type: string | null;
  occurred_at: string; // ISO timestamp
}

export interface StaleClockIn {
  worker_id: string;
  job_id: string;
  occurred_at: string;
}

export function findStaleClockIns(
  entries: readonly TimeEntryInput[],
  now: Date,
  staleHours: number = STALE_HOURS,
): StaleClockIn[] {
  const cutoff = now.getTime() - staleHours * 3_600_000;

  // Latest closing-type timestamp per worker, to compare against their clock-in.
  const lastClosingByWorker = new Map<string, number>();
  for (const e of entries) {
    if (e.type && CLOSING_TYPES.has(e.type)) {
      const t = Date.parse(e.occurred_at);
      if (Number.isNaN(t)) continue;
      const prev = lastClosingByWorker.get(e.worker_id) ?? Number.NEGATIVE_INFINITY;
      if (t > prev) lastClosingByWorker.set(e.worker_id, t);
    }
  }

  const stale: StaleClockIn[] = [];
  for (const e of entries) {
    if (e.type !== 'clock_in') continue;
    const clockInAt = Date.parse(e.occurred_at);
    if (Number.isNaN(clockInAt)) continue;
    if (clockInAt >= cutoff) continue; // not yet 6h old

    const lastClosing = lastClosingByWorker.get(e.worker_id) ?? Number.NEGATIVE_INFINITY;
    if (lastClosing > clockInAt) continue; // closed out after this clock-in

    stale.push({ worker_id: e.worker_id, job_id: e.job_id, occurred_at: e.occurred_at });
  }
  return stale;
}
