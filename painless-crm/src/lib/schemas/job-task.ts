import { z } from 'zod';

// Phase 19 — job task checklist (ADR-028). A flat, lightweight checklist: a
// title, optional due date, optional assignee. No dependencies or sub-tasks.

const TITLE_MAX = 500;

export const AddJobTaskSchema = z.object({
  job_id: z.string().uuid(),
  title: z.string().trim().min(1, 'Task cannot be empty').max(TITLE_MAX),
  due_date: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Expected YYYY-MM-DD' })
      .optional(),
  ),
  assigned_to_id: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().uuid().optional(),
  ),
});

export type AddJobTaskInput = z.infer<typeof AddJobTaskSchema>;

// Checkboxes post 'on' when ticked and nothing when cleared.
export const ToggleJobTaskSchema = z.object({
  id: z.string().uuid(),
  job_id: z.string().uuid(),
  done: z
    .union([z.literal('on'), z.literal('true'), z.literal('false'), z.literal('off'), z.null()])
    .optional()
    .transform((v) => v === 'on' || v === 'true'),
});

export const DeleteJobTaskSchema = z.object({
  id: z.string().uuid(),
  job_id: z.string().uuid(),
});
