import { requireUser } from '@/lib/auth/require-role';
import { type CustomFieldDef, parseDefs, readValues } from '@/lib/custom-fields/defs';
import { createClient } from '@/lib/supabase/server';

// Phase 25a — custom field definition reads. Defs live on the tenant settings
// row as config-as-data; parseDefs validates them at read. See ADR-034.

export async function getCustomFieldDefsForCompany(companyId: string): Promise<CustomFieldDef[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('settings')
    .select('custom_field_defs')
    .eq('company_id', companyId)
    .maybeSingle();
  return parseDefs((data as { custom_field_defs: unknown } | null)?.custom_field_defs);
}

export async function getCustomFieldDefs(): Promise<CustomFieldDef[]> {
  const me = await requireUser();
  return getCustomFieldDefsForCompany(me.company_id);
}

export async function getJobCustomFields(
  jobId: string,
): Promise<Record<string, string | number | boolean>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('jobs')
    .select('custom_fields')
    .eq('id', jobId)
    .maybeSingle();
  return readValues((data as { custom_fields: unknown } | null)?.custom_fields);
}

// Phase 25 — Job Sheet customisation reuses the same engine over a separate
// settings column (settings.job_sheet_fields). See ADR-036.
export async function getJobSheetFieldDefsForCompany(companyId: string): Promise<CustomFieldDef[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('settings')
    .select('job_sheet_fields')
    .eq('company_id', companyId)
    .maybeSingle();
  return parseDefs((data as { job_sheet_fields: unknown } | null)?.job_sheet_fields);
}

export async function getJobSheetFieldDefs(): Promise<CustomFieldDef[]> {
  const me = await requireUser();
  return getJobSheetFieldDefsForCompany(me.company_id);
}
