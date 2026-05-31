import { z } from 'zod';
import { optionalDateFilter } from './common';

export const CUSTOMER_TYPES = ['individual', 'business'] as const;
export type CustomerType = (typeof CUSTOMER_TYPES)[number];

export const ACQUISITION_SOURCES = [
  'website',
  'google_ads',
  'meta_ads',
  'referral',
  'b2b_outreach',
  'affiliate',
  'walk_in',
  'phone',
  'other',
] as const;
export type AcquisitionSource = (typeof ACQUISITION_SOURCES)[number];

const trimNonEmpty = (max: number) => z.string().trim().min(1).max(max);

const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v.length === 0 ? null : v))
    .nullable()
    .optional()
    .transform((v) => v ?? null);

const phone = optionalTrimmed(40);
const email = z
  .string()
  .trim()
  .max(254)
  .transform((v) => (v.length === 0 ? null : v))
  .nullable()
  .optional()
  .refine((v) => v === null || /.+@.+\..+/.test(v ?? ''), { message: 'Invalid email' })
  .transform((v) => v ?? null);

const baseFields = {
  primary_email: email,
  primary_phone: phone,
  acquisition_source: z.enum(ACQUISITION_SOURCES).nullable().optional(),
  acquisition_campaign: optionalTrimmed(120),
  marketing_consent: z.coerce.boolean().default(false),
  notes: optionalTrimmed(4000),
};

export const IndividualCustomerSchema = z.object({
  customer_type: z.literal('individual'),
  first_name: trimNonEmpty(80),
  last_name: trimNonEmpty(80),
  company_name: z.null().default(null),
  vat_number: z.null().default(null),
  payment_terms_days: z.null().default(null),
  ...baseFields,
});

export const BusinessCustomerSchema = z.object({
  customer_type: z.literal('business'),
  company_name: trimNonEmpty(160),
  first_name: optionalTrimmed(80),
  last_name: optionalTrimmed(80),
  vat_number: optionalTrimmed(40),
  payment_terms_days: z.coerce.number().int().min(0).max(120).nullable().optional(),
  ...baseFields,
});

export const CustomerSchema = z
  .discriminatedUnion('customer_type', [IndividualCustomerSchema, BusinessCustomerSchema])
  .superRefine((value, ctx) => {
    if (value.primary_email === null && value.primary_phone === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide an email or phone number',
        path: ['primary_email'],
      });
    }
  });
export type CustomerInput = z.infer<typeof CustomerSchema>;

export const CustomerIdSchema = z.string().uuid();
export const CustomerVersionSchema = z.coerce.number().int().min(1);

export const CustomerListFiltersSchema = z
  .object({
    q: z.string().trim().max(100).optional(),
    type: z.enum(CUSTOMER_TYPES).optional(),
    // Phase 06b §8 — bound the signup window for filtered accountant exports.
    created_from: optionalDateFilter,
    created_to: optionalDateFilter,
    page: z.coerce.number().int().min(1).default(1),
  })
  .refine((v) => !v.created_from || !v.created_to || v.created_from <= v.created_to, {
    message: 'created_from must not be after created_to',
    path: ['created_to'],
  });
export type CustomerListFilters = z.infer<typeof CustomerListFiltersSchema>;

export const CUSTOMER_PAGE_SIZE = 50;
