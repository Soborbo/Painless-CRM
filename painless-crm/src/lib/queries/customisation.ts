import { requireUser } from '@/lib/auth/require-role';
import { type CubicPreset, parseCubicPresets } from '@/lib/customisation/cubic-presets';
import { type DocumentText, resolveDocumentText } from '@/lib/customisation/document-text';
import { type LeadProvider, parseLeadProviders } from '@/lib/customisation/lead-providers';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

// Phase 25b/25c/26 — tenant customisation reads (config-as-data on settings).

const CONFIG_COLUMNS = 'document_text, cubic_presets, lead_provider_config';

type ConfigRow = {
  document_text: unknown;
  cubic_presets: unknown;
  lead_provider_config: unknown;
};

async function readConfigRow(companyId: string): Promise<ConfigRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('settings')
    .select(CONFIG_COLUMNS)
    .eq('company_id', companyId)
    .maybeSingle();
  return (data as ConfigRow | null) ?? null;
}

export async function getDocumentText(): Promise<DocumentText> {
  const me = await requireUser();
  return resolveDocumentText((await readConfigRow(me.company_id))?.document_text);
}

// Anonymous read for the public acceptance page (token already verified).
export async function getDocumentTextByCompanyId(companyId: string): Promise<DocumentText> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('settings')
    .select('document_text')
    .eq('company_id', companyId)
    .maybeSingle();
  return resolveDocumentText((data as { document_text: unknown } | null)?.document_text);
}

export async function getCubicPresets(): Promise<CubicPreset[]> {
  const me = await requireUser();
  return parseCubicPresets((await readConfigRow(me.company_id))?.cubic_presets);
}

export async function getCubicPresetsForCompany(companyId: string): Promise<CubicPreset[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('settings')
    .select('cubic_presets')
    .eq('company_id', companyId)
    .maybeSingle();
  return parseCubicPresets((data as { cubic_presets: unknown } | null)?.cubic_presets);
}

export async function getLeadProviders(): Promise<LeadProvider[]> {
  const me = await requireUser();
  return parseLeadProviders((await readConfigRow(me.company_id))?.lead_provider_config);
}
