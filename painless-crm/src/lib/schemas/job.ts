import { JOB_STAGES } from '@/lib/jobs/state-machine';
import { z } from 'zod';

export const ACQUISITION_SOURCES = [
  'website',
  'google_ads',
  'meta_ads',
  'referral',
  'b2b_outreach',
  'affiliate',
  'walk_in',
  'phone',
  'other',
] as const;
export type AcquisitionSource = (typeof ACQUISITION_SOURCES)[number];

export const DECLINE_REASONS = [
  'too_expensive',
  'chose_competitor',
  'timing',
  'scope_changed',
  'other',
] as const;

export const DEPOSIT_REFUND_DECISIONS = [
  'refund_full',
  'refund_partial',
  'retain_per_terms',
] as const;

const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v.length === 0 ? null : v))
    .nullable()
    .optional()
    .transform((v) => v ?? null);

const optionalDate = z
  .string()
  .trim()
  .max(40)
  .transform((v) => (v.length === 0 ? null : v))
  .nullable()
  .optional()
  .refine((v) => v === null || v === undefined || !Number.isNaN(Date.parse(v ?? '')), {
    message: 'Invalid date',
  })
  .transform((v) => (v ? new Date(v).toISOString() : null));

export const CreateJobSchema = z.object({
  customer_id: z.string().uuid(),
  acquisition_source: z.enum(ACQUISITION_SOURCES),
  assigned_to_id: z.string().uuid().nullable().optional(),
  move_date: optionalDate,
  notes: optionalTrimmed(4000),
});
export type CreateJobInput = z.infer<typeof CreateJobSchema>;

export const UpdateJobSchema = z.object({
  id: z.string().uuid(),
  version: z.coerce.number().int().min(1),
  acquisition_source: z.enum(ACQUISITION_SOURCES),
  assigned_to_id: z
    .string()
    .uuid()
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  surveyor_id: z
    .string()
    .uuid()
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  move_date: optionalDate,
  notes: optionalTrimmed(4000),
});
export type UpdateJobInput = z.infer<typeof UpdateJobSchema>;

export const TransitionJobSchema = z
  .object({
    id: z.string().uuid(),
    version: z.coerce.number().int().min(1),
    target_stage: z.enum(JOB_STAGES),
    reason: optionalTrimmed(500),
    decline_reason: z.enum(DECLINE_REASONS).nullable().optional(),
    cancellation_reason: optionalTrimmed(500),
    deposit_refund_decision: z.enum(DEPOSIT_REFUND_DECISIONS).nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.target_stage === 'declined' && !value.decline_reason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Decline reason is required',
        path: ['decline_reason'],
      });
    }
    if (value.target_stage === 'cancelled') {
      if (!value.cancellation_reason) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Cancellation reason is required',
          path: ['cancellation_reason'],
        });
      }
      if (!value.deposit_refund_decision) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Deposit refund decision is required',
          path: ['deposit_refund_decision'],
        });
      }
    }
  });
export type TransitionJobInput = z.infer<typeof TransitionJobSchema>;

export const AssignJobSchema = z.object({
  id: z.string().uuid(),
  version: z.coerce.number().int().min(1),
  assigned_to_id: z.string().uuid(),
});

export const JobTagSchema = z.object({
  job_id: z.string().uuid(),
  tag: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .regex(/^[\w\-+ ]+$/, { message: 'Tag may only contain letters, numbers, spaces, -, +, _' }),
});

// Calendar-day filter (matches an <input type="date"> value). Empty strings
// arriving from the URL collapse to undefined so an unset control is a no-op.
const optionalDateFilter = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Expected YYYY-MM-DD' })
    .optional(),
);

export const JobListFiltersSchema = z
  .object({
    q: z.string().trim().max(100).optional(),
    stage: z.enum(JOB_STAGES).optional(),
    assigned_to_id: z.string().uuid().optional(),
    // Phase 06b §8 — bound the move-date window for filtered ops exports.
    move_from: optionalDateFilter,
    move_to: optionalDateFilter,
    page: z.coerce.number().int().min(1).default(1),
  })
  .refine((v) => !v.move_from || !v.move_to || v.move_from <= v.move_to, {
    message: 'move_from must not be after move_to',
    path: ['move_to'],
  });
export type JobListFilters = z.infer<typeof JobListFiltersSchema>;

export const JOB_PAGE_SIZE = 50;
