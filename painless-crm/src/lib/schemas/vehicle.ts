import { z } from 'zod';

// Phase 08 §Vehicles. Mirrors the `vehicles` table (Phase 02 schema): a fleet
// vehicle with capacity, monthly cost, and four compliance due-dates.

export const VEHICLE_TYPES = ['luton', 'transit', '7.5t', '18t', 'trailer', 'car'] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

const optionalDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a YYYY-MM-DD date')
  .refine((v) => !Number.isNaN(Date.parse(v)), 'Invalid date')
  .optional()
  .or(z.literal('').transform(() => undefined));

// A blank numeric field arrives as '' from the form; coerce to undefined first.
const optionalNonNegInt = z
  .union([z.literal(''), z.coerce.number().int().min(0).max(2_000_000)])
  .transform((v) => (v === '' ? undefined : v))
  .optional();

const optionalPositiveNumber = z
  .union([z.literal(''), z.coerce.number().min(0).max(100_000)])
  .transform((v) => (v === '' ? undefined : v))
  .optional();

export const VehicleSchema = z.object({
  registration: z.string().trim().min(1, 'Registration is required').max(20).toUpperCase(),
  type: z.enum(VEHICLE_TYPES),
  capacity_cubic_ft: optionalPositiveNumber,
  monthly_cost_pence: optionalNonNegInt,
  active: z.boolean(),
  compliance_alerts_enabled: z.boolean(),
  mot_due: optionalDate,
  tax_due: optionalDate,
  insurance_due: optionalDate,
  next_service_due: optionalDate,
});

export type VehicleInput = z.infer<typeof VehicleSchema>;

export const VehicleIdSchema = z.string().uuid('Invalid vehicle id');
export const VehicleVersionSchema = z.coerce.number().int().min(1);

export const VEHICLE_PAGE_SIZE = 50;

export const VehicleListFiltersSchema = z.object({
  type: z.enum(VEHICLE_TYPES).optional(),
  active: z.enum(['all', 'active', 'inactive']).default('active'),
  page: z.coerce.number().int().min(1).default(1),
});

export type VehicleListFilters = z.infer<typeof VehicleListFiltersSchema>;
