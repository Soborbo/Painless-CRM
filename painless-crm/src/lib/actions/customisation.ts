'use server';

import { requireRole } from '@/lib/auth/require-role';
import {
  CubicPresetSchema,
  MAX_PRESETS,
  parseCubicPresets,
} from '@/lib/customisation/cubic-presets';
import { DocumentTextSchema } from '@/lib/customisation/document-text';
import {
  LeadProviderSchema,
  MAX_PROVIDERS,
  parseLeadProviders,
} from '@/lib/customisation/lead-providers';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

// Phase 25b/25c/26 — customisation config writes (config-as-data, ADR-034/035).

type DbClient = Awaited<ReturnType<typeof createClient>>;
type ConfigColumn = 'document_text' | 'cubic_presets' | 'lead_provider_config';

const ADMIN = ['admin', 'super_admin'] as const;
const MANAGER = ['manager', 'admin', 'super_admin'] as const;

export type CustomisationState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'ok' };

export const INITIAL_CUSTOMISATION_STATE: CustomisationState = { status: 'idle' };

async function readCol(supabase: DbClient, companyId: string, col: ConfigColumn): Promise<unknown> {
  const { data } = await supabase
    .from('settings')
    .select(col)
    .eq('company_id', companyId)
    .maybeSingle();
  return (data as Record<string, unknown> | null)?.[col];
}

async function writeCol(supabase: DbClient, companyId: string, col: ConfigColumn, value: unknown) {
  return supabase
    .from('settings')
    .upsert(
      { company_id: companyId, [col]: value, updated_at: new Date().toISOString() },
      { onConflict: 'company_id' },
    );
}

export async function saveDocumentText(
  _prev: CustomisationState,
  form: FormData,
): Promise<CustomisationState> {
  const me = await requireRole(ADMIN);
  const parsed = DocumentTextSchema.safeParse({
    acceptance_terms: form.get('acceptance_terms') ?? '',
    signoff_declaration: form.get('signoff_declaration') ?? '',
    quote_footer: form.get('quote_footer') ?? '',
  });
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }
  const supabase = await createClient();
  const { error } = await writeCol(supabase, me.company_id, 'document_text', parsed.data);
  if (error) return { status: 'error', message: 'Could not save the document text' };
  revalidatePath('/dashboard/settings/document-text');
  return { status: 'ok' };
}

export async function addCubicPreset(
  _prev: CustomisationState,
  form: FormData,
): Promise<CustomisationState> {
  const me = await requireRole(MANAGER);
  const parsed = CubicPresetSchema.safeParse({
    name: form.get('name'),
    cubic_ft: form.get('cubic_ft'),
  });
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }
  const supabase = await createClient();
  const presets = parseCubicPresets(await readCol(supabase, me.company_id, 'cubic_presets'));
  if (presets.some((p) => p.name.toLowerCase() === parsed.data.name.toLowerCase())) {
    return { status: 'error', message: 'A preset with that name already exists' };
  }
  if (presets.length >= MAX_PRESETS) return { status: 'error', message: 'Too many presets' };
  const { error } = await writeCol(supabase, me.company_id, 'cubic_presets', [
    ...presets,
    parsed.data,
  ]);
  if (error) return { status: 'error', message: 'Could not save the preset' };
  revalidatePath('/dashboard/settings/cubic-presets');
  return { status: 'ok' };
}

export async function deleteCubicPreset(
  _prev: CustomisationState,
  form: FormData,
): Promise<CustomisationState> {
  const me = await requireRole(MANAGER);
  const name = String(form.get('name') ?? '');
  const supabase = await createClient();
  const presets = parseCubicPresets(await readCol(supabase, me.company_id, 'cubic_presets'));
  const next = presets.filter((p) => p.name !== name);
  const { error } = await writeCol(supabase, me.company_id, 'cubic_presets', next);
  if (error) return { status: 'error', message: 'Could not remove the preset' };
  revalidatePath('/dashboard/settings/cubic-presets');
  return { status: 'ok' };
}

export async function addLeadProvider(
  _prev: CustomisationState,
  form: FormData,
): Promise<CustomisationState> {
  const me = await requireRole(ADMIN);
  const parsed = LeadProviderSchema.safeParse({
    name: form.get('name'),
    source_key: form.get('source_key'),
    active: form.get('active') !== 'off',
  });
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }
  const supabase = await createClient();
  const providers = parseLeadProviders(
    await readCol(supabase, me.company_id, 'lead_provider_config'),
  );
  if (providers.some((p) => p.name.toLowerCase() === parsed.data.name.toLowerCase())) {
    return { status: 'error', message: 'A provider with that name already exists' };
  }
  if (providers.length >= MAX_PROVIDERS) return { status: 'error', message: 'Too many providers' };
  const { error } = await writeCol(supabase, me.company_id, 'lead_provider_config', [
    ...providers,
    parsed.data,
  ]);
  if (error) return { status: 'error', message: 'Could not save the provider' };
  revalidatePath('/dashboard/settings/lead-providers');
  return { status: 'ok' };
}

export async function deleteLeadProvider(
  _prev: CustomisationState,
  form: FormData,
): Promise<CustomisationState> {
  const me = await requireRole(ADMIN);
  const name = String(form.get('name') ?? '');
  const supabase = await createClient();
  const providers = parseLeadProviders(
    await readCol(supabase, me.company_id, 'lead_provider_config'),
  );
  const { error } = await writeCol(
    supabase,
    me.company_id,
    'lead_provider_config',
    providers.filter((p) => p.name !== name),
  );
  if (error) return { status: 'error', message: 'Could not remove the provider' };
  revalidatePath('/dashboard/settings/lead-providers');
  return { status: 'ok' };
}
