'use server';

import { requireRole } from '@/lib/auth/require-role';
import { CompanySettingsSchema, SettingsVersionSchema } from '@/lib/schemas/settings';
import { isVersionConflict } from '@/lib/settings/branding';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

// Phase 18 — Company Settings & Branding. Edits the existing `settings` row
// (optimistic version lock) plus the tenant display name on `companies`.

const COMPANY_ROLES = ['manager', 'admin', 'super_admin'] as const;
const PAGE = '/dashboard/settings/company';

export type CompanySettingsActionState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'ok' };

export const INITIAL_COMPANY_SETTINGS_STATE: CompanySettingsActionState = { status: 'idle' };

export async function updateCompanySettings(
  _prev: CompanySettingsActionState,
  form: FormData,
): Promise<CompanySettingsActionState> {
  const me = await requireRole(COMPANY_ROLES);

  const versionResult = SettingsVersionSchema.safeParse(form.get('version'));
  if (!versionResult.success) {
    return { status: 'error', message: 'Missing version' };
  }
  const parsed = CompanySettingsSchema.safeParse({
    company_name: form.get('company_name'),
    brand_color: form.get('brand_color'),
    logo_url: form.get('logo_url'),
    vat_number: form.get('vat_number'),
    ico_registration: form.get('ico_registration'),
    default_quote_validity_days: form.get('default_quote_validity_days'),
    default_deposit_percent: form.get('default_deposit_percent'),
    default_currency: form.get('default_currency'),
    default_locale: form.get('default_locale'),
    default_timezone: form.get('default_timezone'),
  });
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const supabase = await createClient();
  const { company_name, logo_url, vat_number, ico_registration, ...rest } = parsed.data;
  const now = new Date().toISOString();
  const fields = {
    ...rest,
    logo_url: logo_url ?? null,
    vat_number: vat_number ?? null,
    ico_registration: ico_registration ?? null,
    updated_at: now,
  };

  const version = versionResult.data;
  if (version === 0) {
    // No settings row exists yet — create it at version 1.
    const { error } = await supabase
      .from('settings')
      .insert({ ...fields, company_id: me.company_id, version: 1 });
    if (error) return { status: 'error', message: 'Could not save company settings' };
  } else {
    const { data, error } = await supabase
      .from('settings')
      .update({ ...fields, version: version + 1 })
      .eq('company_id', me.company_id)
      .eq('version', version)
      .select('company_id')
      .maybeSingle();
    if (error) return { status: 'error', message: 'Could not save company settings' };
    if (isVersionConflict(data)) {
      return {
        status: 'error',
        message: 'Settings were changed by someone else. Reload and try again.',
      };
    }
  }

  // Company display name lives on the tenant row, not on settings.
  const { error: companyError } = await supabase
    .from('companies')
    .update({ name: company_name, updated_at: now })
    .eq('id', me.company_id);
  if (companyError) return { status: 'error', message: 'Could not save the company name' };

  revalidatePath(PAGE);
  return { status: 'ok' };
}
