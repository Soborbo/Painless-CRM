import { z } from 'zod';

// Phase 06b §2. Pence-integer inputs only. Negative numbers are not
// allowed at v0.1 — reversals will land later as their own line items.
// The action discriminator on top lets one form drive three intents.

const pence = z
  .string()
  .trim()
  .max(12)
  .transform((v) => (v.length === 0 ? null : v))
  .refine((v) => v === null || /^\d+$/.test(v), { message: 'Use whole pence, no decimals' })
  .transform((v) => (v === null ? 0 : Number.parseInt(v, 10)))
  .refine((v) => v >= 0, { message: 'Costs cannot be negative' })
  .refine((v) => v <= 999_999_999, { message: 'Too large' });

export const ProfitReviewSubmitSchema = z.object({
  job_id: z.string().uuid(),
  version: z.coerce.number().int().min(1),
  intent: z.enum(['save', 'mark_reviewed', 'finalize']),
  actual_crew_cost_pence: pence,
  actual_van_cost_pence: pence,
  passthrough_costs_pence: pence,
});
export type ProfitReviewSubmitInput = z.infer<typeof ProfitReviewSubmitSchema>;
