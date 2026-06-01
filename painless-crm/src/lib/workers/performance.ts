// Phase 08 §Workers — performance summary. Pure: fold a worker's job
// assignments into the headline figures the profile shows. Hours worked and
// customer-rating average need time_entries (Phase 09/10) and reviews (Phase
// 11), so they are out of scope here; this covers what the schema supports today.

export const ASSIGNMENT_ROLES = ['lead_loader', 'loader', 'driver', 'surveyor'] as const;
export type AssignmentRole = (typeof ASSIGNMENT_ROLES)[number];

export interface AssignmentInput {
  job_id: string;
  role: string | null;
}

export interface WorkerPerformance {
  totalAssignments: number;
  distinctJobs: number;
  byRole: Record<AssignmentRole, number>;
}

function emptyRoleCounts(): Record<AssignmentRole, number> {
  return { lead_loader: 0, loader: 0, driver: 0, surveyor: 0 };
}

function isAssignmentRole(value: unknown): value is AssignmentRole {
  return typeof value === 'string' && (ASSIGNMENT_ROLES as readonly string[]).includes(value);
}

export function summariseWorkerPerformance(
  assignments: readonly AssignmentInput[],
): WorkerPerformance {
  const byRole = emptyRoleCounts();
  const jobs = new Set<string>();
  for (const a of assignments) {
    if (isAssignmentRole(a.role)) byRole[a.role] += 1;
    jobs.add(a.job_id);
  }
  return {
    totalAssignments: assignments.length,
    distinctJobs: jobs.size,
    byRole,
  };
}
