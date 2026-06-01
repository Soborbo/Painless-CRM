import { CAPACITY_BANDS } from '@/lib/capacity/band';
import { z } from 'zod';

// Admin capacity override input. A forced band on a given day, with a reason
// (required — the override is documented per ADR-022 / Phase 07 §7).

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a YYYY-MM-DD date')
  .refine((v) => !Number.isNaN(Date.parse(v)), 'Invalid date');

export const SetCapacityOverrideSchema = z.object({
  date: isoDate,
  forced_band: z.enum(CAPACITY_BANDS),
  reason: z.string().trim().min(3).max(500),
});

export const ClearCapacityOverrideSchema = z.object({
  date: isoDate,
});

export type SetCapacityOverrideInput = z.infer<typeof SetCapacityOverrideSchema>;
