// Phase 08 §Rota — conflict detection. Pure: a worker can't be on two jobs at
// once. Two assignments for the same worker on the same date conflict when their
// time windows overlap; an assignment with no times is treated as all-day, so
// it conflicts with anything else that day. Assignments to the *same* job never
// conflict (a worker can hold more than one role on one job).

export const ASSIGNMENT_ROLES = ['lead_loader', 'loader', 'driver', 'surveyor'] as const;
export type AssignmentRole = (typeof ASSIGNMENT_ROLES)[number];

export interface AssignmentSlot {
  job_id: string;
  worker_id: string;
  date: string; // YYYY-MM-DD
  scheduled_start: string | null; // HH:MM[:SS]
  scheduled_end: string | null;
}

// Minutes since midnight, or null if unparseable/empty.
export function timeToMinutes(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})/.exec(value.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

// Half-open overlap [start, end). A missing start or end on either side means
// "all day" → always overlaps. Touching edges (a.end === b.start) do not.
export function rangesOverlap(
  aStart: string | null,
  aEnd: string | null,
  bStart: string | null,
  bEnd: string | null,
): boolean {
  const as = timeToMinutes(aStart);
  const ae = timeToMinutes(aEnd);
  const bs = timeToMinutes(bStart);
  const be = timeToMinutes(bEnd);
  if (as === null || ae === null || bs === null || be === null) return true;
  return as < be && bs < ae;
}

// The first existing assignment that clashes with the candidate, or null.
export function findWorkerConflict(
  candidate: AssignmentSlot,
  existing: readonly AssignmentSlot[],
): AssignmentSlot | null {
  for (const other of existing) {
    if (other.worker_id !== candidate.worker_id) continue;
    if (other.date !== candidate.date) continue;
    if (other.job_id === candidate.job_id) continue;
    if (
      rangesOverlap(
        candidate.scheduled_start,
        candidate.scheduled_end,
        other.scheduled_start,
        other.scheduled_end,
      )
    ) {
      return other;
    }
  }
  return null;
}
