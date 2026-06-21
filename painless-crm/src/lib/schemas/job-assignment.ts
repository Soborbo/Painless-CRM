import { ASSIGNMENT_ROLES } from '@/lib/rota/conflicts';
import { z } from 'zod';

// Phase 08 §Rota — assigning a worker (and optionally a vehicle, role and time
// window) to a job on a date.

const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a YYYY-MM-DD date')
  .refine((v) => !Number.isNaN(Date.parse(v)), 'Invalid date');

const optionalUuid = z
  .string()
  .uuid()
  .optional()
  .or(z.literal('').transform(() => undefined));

const optionalTime = z
  .string()
  .regex(/^\d{2}:\d{2}$/, 'Expected HH:MM')
  .optional()
  .or(z.literal('').transform(() => undefined));

export const JobAssignmentSchema = z
  .object({
    job_id: z.string().uuid('Select a job'),
    worker_id: z.string().uuid('Select a worker'),
    vehicle_id: optionalUuid,
    date: isoDate,
    role: z
      .enum(ASSIGNMENT_ROLES)
      .optional()
      .or(z.literal('').transform(() => undefined)),
    scheduled_start: optionalTime,
    scheduled_end: optionalTime,
    notes: z
      .string()
      .trim()
      .max(2000)
      .optional()
      .or(z.literal('').transform(() => undefined)),
  })
  .refine((v) => !v.scheduled_start || !v.scheduled_end || v.scheduled_start < v.scheduled_end, {
    message: 'End time must be after start time',
    path: ['scheduled_end'],
  });

export type JobAssignmentInput = z.infer<typeof JobAssignmentSchema>;

export const AssignmentIdSchema = z.string().uuid('Invalid assignment id');
export const AssignmentVersionSchema = z.coerce.number().int().min(1);

// Auto-assign just needs to know which job, on which day; the crew member is
// chosen server-side by the load-balancer.
export const AutoAssignSchema = z.object({
  job_id: z.string().uuid('Select a job'),
  date: isoDate,
});

export type AutoAssignInput = z.infer<typeof AutoAssignSchema>;

// Drag-to-reassign: move an existing assignment onto another job on the day.
export const ReassignSchema = z.object({
  id: z.string().uuid('Invalid assignment id'),
  version: z.coerce.number().int().min(1),
  job_id: z.string().uuid('Select a job'),
  date: isoDate,
});

export type ReassignInput = z.infer<typeof ReassignSchema>;
