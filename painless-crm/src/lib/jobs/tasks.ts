// Phase 19 — pure helpers for the job task checklist. No I/O so they unit-test
// directly. See ADR-028.

export interface TaskLike {
  done: boolean;
  sort_order: number;
}

export interface Completeness {
  total: number;
  done: number;
  percent: number; // 0–100, rounded; 0 when there are no tasks
}

export function completeness(tasks: readonly TaskLike[]): Completeness {
  const total = tasks.length;
  const done = tasks.filter((t) => t.done).length;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  return { total, done, percent };
}

// Next slot for an appended task: one past the current max, or 0 for an empty
// list. Keeps new tasks at the bottom without renumbering the rest.
export function nextSortOrder(tasks: readonly TaskLike[]): number {
  if (tasks.length === 0) return 0;
  return Math.max(...tasks.map((t) => t.sort_order)) + 1;
}
