import { z } from 'zod';

// Mirrors painless-crm-spec/phases/05-pricing-engine.md.
// Painlessremovals v4.2 calculator uses the same shape; the shared test
// fixtures (tests/pricing/v4.2-fixtures.spec.ts) gate any drift.

export const CAPACITY_BANDS = ['green', 'yellow', 'red'] as const;
export type CapacityBand = (typeof CAPACITY_BANDS)[number];

const intPence = z.number().int().nonnegative();

export const PassThroughConfigSchema = z.object({
  fuel_per_mile_pence: intPence,
  insurance_per_job_pence: intPence,
  waste_disposal_fixed_pence: intPence.nullable(),
});

export const ComplicationSchema = z.object({
  code: z.string().min(1).max(40),
  label: z.string().min(1).max(120),
  points: z.number().int().min(0).max(10),
});

export const SizeCategorySchema = z
  .object({
    code: z.string().min(1).max(40),
    label: z.string().min(1).max(120),
    cubic_ft_min: z.number().nonnegative(),
    cubic_ft_max: z.number().positive(),
    crew_size: z.number().int().min(1).max(10),
    estimated_hours: z.number().positive(),
  })
  .refine((v) => v.cubic_ft_max > v.cubic_ft_min, {
    message: 'cubic_ft_max must exceed cubic_ft_min',
    path: ['cubic_ft_max'],
  });

export const DistanceBandSchema = z
  .object({
    code: z.string().min(1).max(40),
    miles_min: z.number().nonnegative(),
    miles_max: z.number().positive(),
  })
  .refine((v) => v.miles_max > v.miles_min, {
    message: 'miles_max must exceed miles_min',
    path: ['miles_max'],
  });

export const CapacityBandConfigSchema = z.object({
  band: z.enum(CAPACITY_BANDS),
  max_utilization: z.number().min(0).max(1),
  margin_delta: z.number().min(-0.5).max(0.5),
});

export const PricingConfigSchema = z.object({
  version_label: z.string().min(1).max(80),
  margin_matrix: z.array(z.array(z.number().min(0).max(1)).length(3)).length(5),
  crew_hourly_rate_pence: intPence,
  van_hourly_rate_pence: intPence,
  pass_through_config: PassThroughConfigSchema,
  complications: z.array(ComplicationSchema).max(64),
  size_categories: z.array(SizeCategorySchema).min(1).max(20),
  distance_bands: z.array(DistanceBandSchema).length(3),
  dynamic_pricing_enabled: z.boolean(),
  capacity_bands: z.array(CapacityBandConfigSchema).max(3).optional(),
  modulation_sources: z.array(z.string().min(1).max(40)).max(20).optional(),
  quote_validity_days: z.number().int().min(1).max(365).default(7),
  notes: z.string().max(2000).optional().nullable(),
});

export type PricingConfig = z.infer<typeof PricingConfigSchema>;

export const QuoteInputSchema = z.object({
  size_code: z.string().min(1).max(40),
  distance_miles: z.number().nonnegative().max(2000),
  complications: z.array(z.string().min(1).max(40)).max(20).default([]),
  source: z.string().min(1).max(40).optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD')
    .optional(),
});

export type QuoteInput = z.infer<typeof QuoteInputSchema>;

export const PublishPricingSchema = z.object({
  config: PricingConfigSchema,
  notes: z.string().max(2000).optional().nullable(),
});

export type PublishPricingInput = z.infer<typeof PublishPricingSchema>;
