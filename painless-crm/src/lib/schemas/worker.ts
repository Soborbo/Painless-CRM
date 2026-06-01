import { z } from 'zod';

// Phase 08 §Workers. Contractors (no PAYE — ADR-006): name, contact, hourly
// rate, free-text skills/certifications. Rate is entered in pounds, stored as
// integer pence.

const optionalNonNegInt = z
  .union([z.literal(''), z.coerce.number().int().min(0).max(1_000_000)])
  .transform((v) => (v === '' ? undefined : v))
  .optional();

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal('').transform(() => undefined));

export const WorkerSchema = z.object({
  full_name: z.string().trim().min(1, 'Name is required').max(120),
  phone: optionalText(40),
  email: z
    .string()
    .trim()
    .email('Invalid email')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  hourly_rate_pence: optionalNonNegInt,
  skills: optionalText(2000),
  active: z.boolean(),
  notes: optionalText(2000),
});

export type WorkerInput = z.infer<typeof WorkerSchema>;

export const WorkerIdSchema = z.string().uuid('Invalid worker id');
export const WorkerVersionSchema = z.coerce.number().int().min(1);

export const WORKER_PAGE_SIZE = 50;

export const WorkerListFiltersSchema = z.object({
  active: z.enum(['all', 'active', 'inactive']).default('active'),
  page: z.coerce.number().int().min(1).default(1),
});

export type WorkerListFilters = z.infer<typeof WorkerListFiltersSchema>;
