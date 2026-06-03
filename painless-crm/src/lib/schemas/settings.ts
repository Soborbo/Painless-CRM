import { z } from 'zod';

// Phase 18 — Company Settings & Branding. Validates edits to the existing
// `settings` row (plus the tenant's display name on `companies`). No new
// columns are introduced.

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

// Empty string from an unset <input> collapses to undefined so a blank field
// is a no-op (and persists as NULL), not a validation error.
const optionalText = (max: number) =>
  z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().trim().max(max).optional(),
  );

const optionalUrl = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
  z.string().trim().url({ message: 'Enter a valid URL' }).max(2048).optional(),
);

export const CURRENCIES = ['GBP', 'EUR', 'USD'] as const;
export const LOCALES = ['en-GB', 'hu-HU'] as const;

export const CompanySettingsSchema = z.object({
  company_name: z
    .string()
    .trim()
    .min(1, { message: 'Company name is required' })
    .max(200),
  brand_color: z
    .string()
    .trim()
    .regex(HEX_COLOR, { message: 'Use a hex colour like #0066cc' }),
  logo_url: optionalUrl,
  vat_number: optionalText(40),
  ico_registration: optionalText(40),
  default_quote_validity_days: z.coerce.number().int().min(1).max(365),
  default_deposit_percent: z.coerce.number().min(0).max(100),
  default_currency: z.enum(CURRENCIES),
  default_locale: z.enum(LOCALES),
  default_timezone: z.string().trim().min(1).max(64),
});

export type CompanySettingsInput = z.infer<typeof CompanySettingsSchema>;

// Version 0 is the sentinel for "no settings row exists yet" → the action
// inserts at version 1 instead of running a version-guarded update.
export const SettingsVersionSchema = z.coerce.number().int().min(0);
