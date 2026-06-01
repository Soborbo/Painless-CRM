import { CONTAINER_STATUSES } from '@/lib/storage/occupancy';
import { z } from 'zod';

// Phase 08 §Storage. Sites own an address (created inline) and a set of
// containers. Monthly rate is collected in pounds and stored as integer pence.

const optionalNonNegInt = z
  .union([z.literal(''), z.coerce.number().int().min(0).max(2_000_000)])
  .transform((v) => (v === '' ? undefined : v))
  .optional();

const optionalPositiveNumber = z
  .union([z.literal(''), z.coerce.number().min(0).max(100_000)])
  .transform((v) => (v === '' ? undefined : v))
  .optional();

export const StorageSiteSchema = z.object({
  name: z.string().trim().min(1, 'Site name is required').max(120),
  line1: z.string().trim().min(1, 'Address line 1 is required').max(200),
  line2: z
    .string()
    .trim()
    .max(200)
    .optional()
    .or(z.literal('').transform(() => undefined)),
  city: z.string().trim().min(1, 'City is required').max(120),
  postcode: z.string().trim().min(1, 'Postcode is required').max(12),
  total_containers: optionalNonNegInt,
  notes: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .or(z.literal('').transform(() => undefined)),
});

export type StorageSiteInput = z.infer<typeof StorageSiteSchema>;

export const StorageContainerSchema = z.object({
  container_code: z.string().trim().min(1, 'Container code is required').max(40).toUpperCase(),
  size_cubic_ft: optionalPositiveNumber,
  monthly_rate_pence: z.coerce.number().int().min(0).max(2_000_000),
  status: z.enum(CONTAINER_STATUSES),
  notes: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .or(z.literal('').transform(() => undefined)),
});

export type StorageContainerInput = z.infer<typeof StorageContainerSchema>;

export const StorageIdSchema = z.string().uuid('Invalid id');
export const StorageVersionSchema = z.coerce.number().int().min(1);
