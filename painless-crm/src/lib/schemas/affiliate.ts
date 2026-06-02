import { z } from 'zod';

// Phase 16 §1 — affiliate (estate agents / B2B partners) schemas.
//
// commission_value semantics depend on commission_type and are normalised by
// the action before storage:
//   - percent_revenue → stored as a percent (e.g. 7.5 means 7.5% of revenue)
//   - flat_per_job     → stored as integer pence (entered in £ on the form)
//   - tiered           → value unused; tiers live in commission_config (editing
//                        the tier table is deferred — admins set it via config)
// The commission engine in lib/affiliates/commission.ts reads the same contract.

export const AFFILIATE_TYPES = ['estate_agent', 'B2B_partner', 'individual', 'other'] as const;
export type AffiliateType = (typeof AFFILIATE_TYPES)[number];

export const COMMISSION_TYPES = ['percent_revenue', 'flat_per_job', 'tiered'] as const;
export type CommissionType = (typeof COMMISSION_TYPES)[number];

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal('').transform(() => undefined));

const optionalEmail = z
  .string()
  .trim()
  .email('Invalid email')
  .max(160)
  .optional()
  .or(z.literal('').transform(() => undefined));

const optionalNonNeg = z
  .union([z.literal(''), z.coerce.number().min(0).max(1_000_000)])
  .transform((v) => (v === '' ? undefined : v))
  .optional();

export const AffiliateSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(160),
  type: z.enum(AFFILIATE_TYPES),
  contact_name: optionalText(160),
  contact_email: optionalEmail,
  contact_phone: optionalText(40),
  commission_type: z
    .enum(COMMISSION_TYPES)
    .optional()
    .or(z.literal('').transform(() => undefined)),
  // Already normalised by the action (percent or pence per the contract above).
  commission_value: optionalNonNeg,
  active: z.boolean(),
});

export type AffiliateInput = z.infer<typeof AffiliateSchema>;

export const AffiliateIdSchema = z.string().uuid('Invalid affiliate id');
export const AffiliateVersionSchema = z.coerce.number().int().min(1);

// Codes are short, case-insensitively unique referral slugs (stored uppercased).
export const AffiliateCodeSchema = z.object({
  affiliate_id: AffiliateIdSchema,
  code: z
    .string()
    .trim()
    .min(3, 'Code must be at least 3 characters')
    .max(40)
    .regex(/^[A-Za-z0-9_-]+$/, 'Letters, numbers, dashes only')
    .transform((c) => c.toUpperCase()),
});
export type AffiliateCodeInput = z.infer<typeof AffiliateCodeSchema>;

export const AFFILIATE_PAGE_SIZE = 50;

export const AffiliateListFiltersSchema = z.object({
  status: z.enum(['all', 'active', 'pending']).default('all'),
  page: z.coerce.number().int().min(1).default(1),
});
export type AffiliateListFilters = z.infer<typeof AffiliateListFiltersSchema>;
