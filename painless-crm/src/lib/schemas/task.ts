import { z } from 'zod';
import { TASK_KINDS, TASK_PRIORITIES, TASK_RELATED_TYPES, TASK_STATUSES } from '@/lib/tasks/model';

// Phase 27 — unified task validation (ADR-042). Multi-assignee: a task carries
// zero or more assignees. due_at accepts a date (YYYY-MM-DD) or an ISO
// datetime; the action normalizes it to a timestamptz.

const TITLE_MAX = 500;
const DESC_MAX = 4000;

const emptyToUndefined = (v: unknown) =>
  typeof v === 'string' && v.trim() === '' ? undefined : v;

const DUE = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}([T ].*)?$/, { message: 'Expected a date or datetime' })
    .optional(),
);

const ASSIGNEES = z.array(z.string().uuid()).max(20).default([]);

const RELATED_TYPE = z.preprocess(emptyToUndefined, z.enum(TASK_RELATED_TYPES).optional());
const RELATED_ID = z.preprocess(emptyToUndefined, z.string().uuid().optional());
const OPTIONAL_UUID = z.preprocess(emptyToUndefined, z.string().uuid().optional());

export const CreateTaskSchema = z
  .object({
    title: z.string().trim().min(1, 'Task cannot be empty').max(TITLE_MAX),
    description: z.preprocess(emptyToUndefined, z.string().max(DESC_MAX).optional()),
    kind: z.enum(TASK_KINDS).default('followup'),
    priority: z.enum(TASK_PRIORITIES).default('medium'),
    due_at: DUE,
    related_type: RELATED_TYPE,
    related_id: RELATED_ID,
    customer_id: OPTIONAL_UUID,
    job_id: OPTIONAL_UUID,
    assigned_to_ids: ASSIGNEES,
  })
  .refine((d) => (d.related_type ? Boolean(d.related_id) : true), {
    message: 'related_id is required when related_type is set',
    path: ['related_id'],
  });

export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;

export const UpdateTaskSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(TITLE_MAX).optional(),
  description: z.preprocess(emptyToUndefined, z.string().max(DESC_MAX).optional()),
  kind: z.enum(TASK_KINDS).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  status: z.enum(TASK_STATUSES).optional(),
  due_at: DUE,
});

export const CompleteTaskSchema = z.object({
  id: z.string().uuid(),
  // Checkboxes post 'on' when ticked and nothing when cleared.
  done: z
    .union([z.literal('on'), z.literal('true'), z.literal('false'), z.literal('off'), z.null()])
    .optional()
    .transform((v) => v === 'on' || v === 'true'),
});

export const ReassignTaskSchema = z.object({
  id: z.string().uuid(),
  assigned_to_ids: ASSIGNEES,
});

export const SnoozeTaskSchema = z.object({
  id: z.string().uuid(),
  due_at: z.preprocess(
    emptyToUndefined,
    z.string().regex(/^\d{4}-\d{2}-\d{2}([T ].*)?$/, { message: 'Expected a date or datetime' }),
  ),
});

export const DeleteTaskSchema = z.object({
  id: z.string().uuid(),
});

// Normalize a date-only string to a UTC-midnight ISO timestamp; pass ISO
// datetimes through untouched. Returns null for an absent value.
export function dueToIso(due: string | undefined): string | null {
  if (!due) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(due)) return new Date(`${due}T00:00:00.000Z`).toISOString();
  return new Date(due).toISOString();
}
