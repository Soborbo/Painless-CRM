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

  // Latest closing-type timestamp per (worker, job). Keying by worker alone let a
  // clock_out on job B mask a still-open clock-in on job A (audit) — a worker can
  // legitimately be open on one job and closed on another, so freshness must be
  // per job.
  const key = (workerId: string, jobId: string) => `${workerId}|${jobId}`;
  const lastClosingByWorkerJob = new Map<string, number>();
  for (const e of entries) {
    if (e.type && CLOSING_TYPES.has(e.type)) {
      const t = Date.parse(e.occurred_at);
      if (Number.isNaN(t)) continue;
      const k = key(e.worker_id, e.job_id);
      const prev = lastClosingByWorkerJob.get(k) ?? Number.NEGATIVE_INFINITY;
      if (t > prev) lastClosingByWorkerJob.set(k, t);
    }
  }

  const stale: StaleClockIn[] = [];
  for (const e of entries) {
    if (e.type !== 'clock_in') continue;
    const clockInAt = Date.parse(e.occurred_at);
    if (Number.isNaN(clockInAt)) continue;
    if (clockInAt >= cutoff) continue; // not yet 6h old

    const lastClosing =
      lastClosingByWorkerJob.get(key(e.worker_id, e.job_id)) ?? Number.NEGATIVE_INFINITY;
    if (lastClosing > clockInAt) continue; // closed out after this clock-in (same job)

    stale.push({ worker_id: e.worker_id, job_id: e.job_id, occurred_at: e.occurred_at });
  }
  return stale;
}
