import { z } from 'zod';

// Phase 11 §6 — damage-claim schemas. Money fields are entered in £ and
// converted to pence by the action. Photos deferred (Storage bucket).

// A blank £ field arrives as '' from the form; coerce to undefined.
const optionalPounds = z
  .union([z.literal(''), z.coerce.number().min(0).max(1_000_000)])
  .transform((v) => (v === '' ? undefined : v))
  .optional();

const optionalText = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .or(z.literal('').transform(() => undefined));

export const DamageCreateSchema = z.object({
  job_id: z.string().uuid(),
  description: z.string().trim().min(1, 'Describe the damage').max(4000),
  estimated_value_pounds: optionalPounds,
  reported_by_customer: z.coerce.boolean().optional().default(false),
});

export type DamageCreateInput = z.infer<typeof DamageCreateSchema>;

export const DamageUpdateSchema = z.object({
  id: z.string().uuid(),
  version: z.coerce.number().int().nonnegative(),
  status: z.enum(['reported', 'investigating', 'agreed', 'paid', 'denied']),
  estimated_value_pounds: optionalPounds,
  payout_pounds: optionalPounds,
  insurance_claim_ref: optionalText,
});

export type DamageUpdateInput = z.infer<typeof DamageUpdateSchema>;
