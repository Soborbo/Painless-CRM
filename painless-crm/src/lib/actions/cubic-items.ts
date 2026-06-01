'use server';

import { requireRole } from '@/lib/auth/require-role';
import { CubicItemSchema } from '@/lib/schemas/cubic-item';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

const SURVEY_ROLES = ['surveyor', 'manager', 'admin', 'super_admin'] as const;

export type CubicItemActionState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'ok' };

export const INITIAL_CUBIC_ITEM_STATE: CubicItemActionState = { status: 'idle' };

// Resolves the survey's job (for revalidation) and confirms it's live.
async function surveyJobId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  surveyId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('surveys')
    .select('job_id')
    .eq('id', surveyId)
    .is('deleted_at', null)
    .maybeSingle();
  return (data as { job_id: string } | null)?.job_id ?? null;
}

export async function addCubicItem(
  _prev: CubicItemActionState,
  form: FormData,
): Promise<CubicItemActionState> {
  const me = await requireRole(SURVEY_ROLES);

  const parsed = CubicItemSchema.safeParse({
    survey_id: form.get('survey_id'),
    room: form.get('room') || undefined,
    item: form.get('item'),
    quantity: form.get('quantity') || undefined,
    cubic_ft_each: form.get('cubic_ft_each'),
    fragile: form.get('fragile') || undefined,
    dismantle_required: form.get('dismantle_required') || undefined,
    notes: form.get('notes') || undefined,
  });
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const supabase = await createClient();
  const jobId = await surveyJobId(supabase, parsed.data.survey_id);
  if (!jobId) return { status: 'error', message: 'Survey not found' };

  const { error } = await supabase.from('cubic_sheet_items').insert({
    company_id: me.company_id,
    survey_id: parsed.data.survey_id,
    room: parsed.data.room ?? null,
    item: parsed.data.item,
    quantity: parsed.data.quantity,
    cubic_ft_each: parsed.data.cubic_ft_each,
    fragile: parsed.data.fragile,
    dismantle_required: parsed.data.dismantle_required,
    notes: parsed.data.notes ?? null,
  });
  if (error) return { status: 'error', message: 'Could not add the item' };

  revalidatePath(`/dashboard/jobs/${jobId}/surveys/${parsed.data.survey_id}`);
  return { status: 'ok' };
}

// Cubic items have no deleted_at (child of surveys, on-delete-cascade), so a
// line-item removal is a hard delete — consistent with the table design.
export async function removeCubicItem(
  _prev: CubicItemActionState,
  form: FormData,
): Promise<CubicItemActionState> {
  await requireRole(SURVEY_ROLES);
  const id = form.get('id');
  const surveyId = form.get('survey_id');
  if (typeof id !== 'string' || typeof surveyId !== 'string') {
    return { status: 'error', message: 'Missing fields' };
  }

  const supabase = await createClient();
  const jobId = await surveyJobId(supabase, surveyId);
  const { error } = await supabase
    .from('cubic_sheet_items')
    .delete()
    .eq('id', id)
    .eq('survey_id', surveyId);
  if (error) return { status: 'error', message: 'Could not remove the item' };

  if (jobId) revalidatePath(`/dashboard/jobs/${jobId}/surveys/${surveyId}`);
  return { status: 'ok' };
}
