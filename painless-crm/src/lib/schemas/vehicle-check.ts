import { z } from 'zod';

// Phase 09 §vehicle pre-check (deliverable #6). Fuel, mileage, walk-around and
// defects. The dashboard photo + signature are deferred to the photo-upload
// (Supabase Storage) slice; this captures the data fields, offline-first.

const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a YYYY-MM-DD date')
  .refine((v) => !Number.isNaN(Date.parse(v)), 'Invalid date');

const optionalInt = (max: number) =>
  z
    .union([z.literal(''), z.coerce.number().int().min(0).max(max)])
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional()
    .transform((v) => v ?? null);

export const VehicleCheckSchema = z
  .object({
    job_id: z.string().uuid('Invalid job'),
    vehicle_id: z.string().uuid('Invalid vehicle'),
    client_event_id: z.string().uuid('Invalid event id'),
    date: isoDate,
    fuel_level: optionalInt(100),
    mileage: optionalInt(2_000_000),
    // Form/JSON sends 'true'/'false'/'on'; Boolean() would treat 'false' as true,
    // so map explicitly — anything other than a truthy string is false.
    walk_around_clear: z.preprocess((v) => v === true || v === 'true' || v === 'on', z.boolean()),
    defects_noted: z
      .string()
      .trim()
      .max(4000)
      .optional()
      .or(z.literal('').transform(() => undefined)),
    client_recorded_at: z
      .string()
      .datetime({ offset: true })
      .optional()
      .or(z.literal('').transform(() => undefined)),
  })
  .refine((v) => v.walk_around_clear || (v.defects_noted && v.defects_noted.length > 0), {
    message: 'Note the defects you found',
    path: ['defects_noted'],
  });

export type VehicleCheckInput = z.infer<typeof VehicleCheckSchema>;
