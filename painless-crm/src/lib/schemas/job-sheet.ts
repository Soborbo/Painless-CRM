import { z } from 'zod';

// Phase 09 §end-of-job sheet (deliverable #9). Actual hours + cubic feet,
// complications, optional damage, and an internal 1–5 satisfaction note.
// Carries the client UUID for idempotent offline replay.

const optionalNonNegNumber = z
  .union([z.literal(''), z.coerce.number().min(0).max(100_000)])
  .transform((v) => (v === '' ? null : v))
  .nullable()
  .optional()
  .transform((v) => v ?? null);

const optionalText = z
  .string()
  .trim()
  .max(4000)
  .optional()
  .or(z.literal('').transform(() => undefined));

export const JobSheetSchema = z
  .object({
    job_id: z.string().uuid('Invalid job'),
    client_event_id: z.string().uuid('Invalid event id'),
    actual_hours: z.coerce.number().min(0).max(1000),
    actual_cubic_ft: optionalNonNegNumber,
    complications_encountered: optionalText,
    damage_reported: z.coerce.boolean().optional().default(false),
    damage_details: optionalText,
    // Internal satisfaction note, 1–5 (the column allows up to 10).
    customer_satisfaction_score: z
      .union([z.literal(''), z.coerce.number().int().min(1).max(5)])
      .transform((v) => (v === '' ? null : v))
      .nullable()
      .optional()
      .transform((v) => v ?? null),
    client_recorded_at: z
      .string()
      .datetime({ offset: true })
      .optional()
      .or(z.literal('').transform(() => undefined)),
  })
  .refine((v) => !v.damage_reported || (v.damage_details && v.damage_details.length > 0), {
    message: 'Describe the damage you reported',
    path: ['damage_details'],
  });

export type JobSheetInput = z.infer<typeof JobSheetSchema>;
