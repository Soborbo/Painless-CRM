// Phase 11 §7 — per-worker performance aggregation. Pure + tested.
//
// Attribution: every metric is keyed to the loader-in-charge of the job — the
// worker who captured the customer sign-off (customer_signoffs.collected_by_
// worker_id). That gives one coherent owner per completed job, so reviews,
// complaints, damages and satisfaction all roll up to the same person.
// (Internal use only — drives performance reviews; never shown to the customer
// and never gates anything. See ADR-010 / Phase 11 §2.)

export interface SignoffRecord {
  worker_id: string | null;
  job_id: string;
  internal_rating_1_5: number | null;
  review_clicked: boolean; // customer clicked the Google review link
}

export interface WorkerStat {
  worker_id: string;
  worker_name: string;
  jobs: number; // completed jobs they led (have a sign-off)
  reviews: number; // of those, where the customer clicked the review link
  complaints: number;
  damages: number;
  avg_rating: number | null; // mean of recorded 1–5 ratings, rounded to 1dp
}

export function aggregateTeamStats(
  signoffs: SignoffRecord[],
  complaintJobIds: string[],
  damageJobIds: string[],
  workerNames: Map<string, string>,
): WorkerStat[] {
  // job_id -> owning worker (the sign-off collector)
  const jobOwner = new Map<string, string>();
  for (const s of signoffs) {
    if (s.worker_id) jobOwner.set(s.job_id, s.worker_id);
  }

  const acc = new Map<
    string,
    { jobs: number; reviews: number; complaints: number; damages: number; ratings: number[] }
  >();
  const get = (id: string) => {
    let row = acc.get(id);
    if (!row) {
      row = { jobs: 0, reviews: 0, complaints: 0, damages: 0, ratings: [] };
      acc.set(id, row);
    }
    return row;
  };

  for (const s of signoffs) {
    if (!s.worker_id) continue;
    const row = get(s.worker_id);
    row.jobs += 1;
    if (s.review_clicked) row.reviews += 1;
    if (s.internal_rating_1_5 != null) row.ratings.push(s.internal_rating_1_5);
  }

  for (const jobId of complaintJobIds) {
    const owner = jobOwner.get(jobId);
    if (owner) get(owner).complaints += 1;
  }
  for (const jobId of damageJobIds) {
    const owner = jobOwner.get(jobId);
    if (owner) get(owner).damages += 1;
  }

  const stats: WorkerStat[] = [];
  for (const [workerId, row] of acc) {
    const avg =
      row.ratings.length > 0
        ? Math.round((row.ratings.reduce((a, b) => a + b, 0) / row.ratings.length) * 10) / 10
        : null;
    stats.push({
      worker_id: workerId,
      worker_name: workerNames.get(workerId) ?? 'Unknown worker',
      jobs: row.jobs,
      reviews: row.reviews,
      complaints: row.complaints,
      damages: row.damages,
      avg_rating: avg,
    });
  }

  return stats.sort((a, b) => a.worker_name.localeCompare(b.worker_name));
}
