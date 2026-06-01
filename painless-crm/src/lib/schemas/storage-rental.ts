import { z } from 'zod';

// Phase 08 §Storage — opening a rental against a container (ADR-023). Monthly
// rate is collected in pounds and stored as integer pence; defaults to the
// container's rate but can be overridden per rental.

const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a YYYY-MM-DD date')
  .refine((v) => !Number.isNaN(Date.parse(v)), 'Invalid date');

export const CreateRentalSchema = z.object({
  customer_id: z.string().uuid('Select a customer'),
  start_date: isoDate,
  monthly_rate_pence: z.coerce.number().int().min(0).max(2_000_000),
  // 'reserve' opens a pending rental; 'activate' opens an active one straight away.
  mode: z.enum(['reserve', 'activate']),
  notes: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .or(z.literal('').transform(() => undefined)),
});

export type CreateRentalInput = z.infer<typeof CreateRentalSchema>;

export const RentalIdSchema = z.string().uuid('Invalid rental id');
export const RentalVersionSchema = z.coerce.number().int().min(1);
