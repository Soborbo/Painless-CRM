import { requireUser } from '@/lib/auth/require-role';
import { type BrandingSource, DEFAULT_COMPANY_NAME } from '@/lib/settings/branding';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

// Phase 18 — company settings reads. RLS scopes the authed read to the tenant;
// the public branding read uses the admin client for anonymous document pages.

export interface CompanySettings {
  company_name: string;
  logo_url: string | null;
  brand_color: string | null;
  vat_number: string | null;
  ico_registration: string | null;
  default_quote_validity_days: number;
  default_deposit_percent: number;
  default_currency: string;
  default_locale: string;
  default_timezone: string;
  version: number;
}

const COLUMNS =
  'logo_url, brand_color, vat_number, ico_registration, default_quote_validity_days, ' +
  'default_deposit_percent, default_currency, default_locale, default_timezone, version';

// Mirrors the column defaults in migration 00000000000010 so the form renders
// sensibly before a settings row has ever been written. version 0 is the
// "no row yet" sentinel the update action keys off (see schemas/settings.ts).
const SETTINGS_DEFAULTS: Omit<CompanySettings, 'company_name'> = {
  logo_url: null,
  brand_color: '#0066cc',
  vat_number: null,
  ico_registration: null,
  default_quote_validity_days: 7,
  default_deposit_percent: 25,
  default_currency: 'GBP',
  default_locale: 'en-GB',
  default_timezone: 'Europe/London',
  version: 0,
};

export async function getCompanySettings(): Promise<CompanySettings> {
  const me = await requireUser();
  const supabase = await createClient();

  const [{ data: settings }, { data: company }] = await Promise.all([
    supabase.from('settings').select(COLUMNS).eq('company_id', me.company_id).maybeSingle(),
    supabase.from('companies').select('name').eq('id', me.company_id).maybeSingle(),
  ]);

  const row = (settings as Omit<CompanySettings, 'company_name'> | null) ?? SETTINGS_DEFAULTS;
  return {
    company_name: (company as { name: string } | null)?.name ?? DEFAULT_COMPANY_NAME,
    ...row,
  };
}

// Anonymous branding read for customer-facing document pages (quote print,
// later invoices/receipts). Token verification is the caller's responsibility.
export async function getBrandingByCompanyId(companyId: string): Promise<BrandingSource> {
  const supabase = createAdminClient();
  const [{ data: settings }, { data: company }] = await Promise.all([
    supabase
      .from('settings')
      .select('brand_color, logo_url')
      .eq('company_id', companyId)
      .maybeSingle(),
    supabase.from('companies').select('name').eq('id', companyId).maybeSingle(),
  ]);
  const s = settings as { brand_color: string | null; logo_url: string | null } | null;
  return {
    company_name: (company as { name: string } | null)?.name ?? null,
    brand_color: s?.brand_color ?? null,
    logo_url: s?.logo_url ?? null,
  };
}
