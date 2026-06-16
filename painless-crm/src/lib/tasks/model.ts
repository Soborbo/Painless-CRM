// Phase 27 — pure helpers + constants for the unified task entity (ADR-042).
// No I/O, so these unit-test directly.

export const TASK_KINDS = ['followup', 'checklist', 'call'] as const;
export type TaskKind = (typeof TASK_KINDS)[number];

export const TASK_PRIORITIES = ['low', 'medium', 'high'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_STATUSES = ['open', 'in_progress', 'done', 'cancelled'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_RELATED_TYPES = ['customer', 'job', 'quote', 'complaint', 'phone_call'] as const;
export type TaskRelatedType = (typeof TASK_RELATED_TYPES)[number];

// A status is "open" in the worklist sense (still needs action).
export function isActionable(status: TaskStatus): boolean {
  return status === 'open' || status === 'in_progress';
}

export interface DueLike {
  due_at: string | null;
  status: TaskStatus;
}

export type DueBucket = 'overdue' | 'today' | 'upcoming' | 'later' | 'none';

// Classify a task by its due date relative to `now`. Completed/cancelled tasks
// never read as overdue. Day boundaries are UTC, matching how due_at is stored.
export function dueBucket(task: DueLike, now: Date): DueBucket {
  if (!task.due_at) return 'none';
  if (!isActionable(task.status)) return 'none';
  const due = new Date(task.due_at).getTime();
  const startOfToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const startOfTomorrow = startOfToday + 24 * 60 * 60 * 1000;
  const startOfWeekEnd = startOfToday + 7 * 24 * 60 * 60 * 1000;
  if (due < startOfToday) return 'overdue';
  if (due < startOfTomorrow) return 'today';
  if (due < startOfWeekEnd) return 'upcoming';
  return 'later';
}

export function isOverdue(task: DueLike, now: Date): boolean {
  return dueBucket(task, now) === 'overdue';
}

// Higher number = more urgent, for stable queue ordering.
export function priorityRank(priority: TaskPriority): number {
  switch (priority) {
    case 'high':
      return 3;
    case 'medium':
      return 2;
    default:
      return 1;
  }
}

const BUCKET_RANK: Record<DueBucket, number> = {
  overdue: 0,
  today: 1,
  upcoming: 2,
  later: 3,
  none: 4,
};

export interface QueueTask extends DueLike {
  priority: TaskPriority;
}

// Worklist order: overdue first, then by due bucket, then by priority, then by
// soonest due date. Returns a new array; never mutates the input.
export function sortQueue<T extends QueueTask>(tasks: readonly T[], now: Date): T[] {
  return [...tasks].sort((a, b) => {
    const bucketDelta = BUCKET_RANK[dueBucket(a, now)] - BUCKET_RANK[dueBucket(b, now)];
    if (bucketDelta !== 0) return bucketDelta;
    const priorityDelta = priorityRank(b.priority) - priorityRank(a.priority);
    if (priorityDelta !== 0) return priorityDelta;
    const aDue = a.due_at ? new Date(a.due_at).getTime() : Number.POSITIVE_INFINITY;
    const bDue = b.due_at ? new Date(b.due_at).getTime() : Number.POSITIVE_INFINITY;
    return aDue - bDue;
  });
}

export interface Completeness {
  total: number;
  done: number;
  percent: number; // 0–100, rounded; 0 when there are no tasks
}

// Checklist progress badge. Counts 'done' status against the total.
export function completeness(tasks: readonly { status: TaskStatus }[]): Completeness {
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === 'done').length;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  return { total, done, percent };
}

// Next slot for an appended checklist item: one past the current max, or 0 for
// an empty list. Keeps new tasks at the bottom without renumbering the rest.
export function nextSortOrder(tasks: readonly { sort_order: number }[]): number {
  if (tasks.length === 0) return 0;
  return Math.max(...tasks.map((t) => t.sort_order)) + 1;
}
