'use server';

import { requireRole } from '@/lib/auth/require-role';
import { CustomFieldDefSchema, MAX_DEFS, parseDefs, validateValues } from '@/lib/custom-fields/defs';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

// Phase 25a — custom field config + per-job values (ADR-034).

type DbClient = Awaited<ReturnType<typeof createClient>>;

const ADMIN = ['admin', 'super_admin'] as const;
const JOB_ROLES = ['sales', 'manager', 'admin', 'super_admin', 'surveyor', 'accounts'] as const;
const SETTINGS_PAGE = '/dashboard/settings/custom-fields';

export type CustomFieldActionState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'ok' };

export const INITIAL_CF_STATE: CustomFieldActionState = { status: 'idle' };

async function readDefs(supabase: DbClient, companyId: string) {
  const { data } = await supabase
    .from('settings')
    .select('custom_field_defs')
    .eq('company_id', companyId)
    .maybeSingle();
  return parseDefs((data as { custom_field_defs: unknown } | null)?.custom_field_defs);
}

async function writeDefs(supabase: DbClient, companyId: string, defs: unknown) {
  return supabase
    .from('settings')
    .upsert(
      { company_id: companyId, custom_field_defs: defs, updated_at: new Date().toISOString() },
      { onConflict: 'company_id' },
    );
}

export async function addCustomFieldDef(
  _prev: CustomFieldActionState,
  form: FormData,
): Promise<CustomFieldActionState> {
  const me = await requireRole(ADMIN);
  const optionsRaw = String(form.get('options') ?? '').trim();
  const parsed = CustomFieldDefSchema.safeParse({
    key: String(form.get('key') ?? '').trim(),
    label: String(form.get('label') ?? '').trim(),
    type: String(form.get('type') ?? ''),
    options: optionsRaw
      ? optionsRaw.split(',').map((s) => s.trim()).filter(Boolean)
      : undefined,
    required: form.get('required') === 'on',
  });
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Invalid field' };
  }

  const supabase = await createClient();
  const defs = await readDefs(supabase, me.company_id);
  if (defs.some((d) => d.key === parsed.data.key)) {
    return { status: 'error', message: 'A field with that key already exists' };
  }
  if (defs.length >= MAX_DEFS) return { status: 'error', message: 'Too many custom fields' };

  const { error } = await writeDefs(supabase, me.company_id, [...defs, parsed.data]);
  if (error) return { status: 'error', message: 'Could not save the field' };
  revalidatePath(SETTINGS_PAGE);
  return { status: 'ok' };
}

export async function deleteCustomFieldDef(
  _prev: CustomFieldActionState,
  form: FormData,
): Promise<CustomFieldActionState> {
  const me = await requireRole(ADMIN);
  const key = String(form.get('key') ?? '');
  const supabase = await createClient();
  const defs = await readDefs(supabase, me.company_id);
  const { error } = await writeDefs(
    supabase,
    me.company_id,
    defs.filter((d) => d.key !== key),
  );
  if (error) return { status: 'error', message: 'Could not remove the field' };
  revalidatePath(SETTINGS_PAGE);
  return { status: 'ok' };
}

export async function saveJobCustomFields(
  _prev: CustomFieldActionState,
  form: FormData,
): Promise<CustomFieldActionState> {
  const me = await requireRole(JOB_ROLES);
  const jobId = String(form.get('job_id') ?? '');
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) return { status: 'error', message: 'Missing job' };

  const supabase = await createClient();
  const defs = await readDefs(supabase, me.company_id);
  const input: Record<string, string> = {};
  for (const d of defs) {
    const v = form.get(`cf_${d.key}`);
    input[d.key] = typeof v === 'string' ? v : '';
  }
  const { values, errors } = validateValues(defs, input);
  const firstError = Object.values(errors)[0];
  if (firstError) return { status: 'error', message: firstError };

  const { error } = await supabase
    .from('jobs')
    .update({ custom_fields: values })
    .eq('id', jobId)
    .is('deleted_at', null);
  if (error) return { status: 'error', message: 'Could not save the custom fields' };
  revalidatePath(`/dashboard/jobs/${jobId}`);
  return { status: 'ok' };
}
