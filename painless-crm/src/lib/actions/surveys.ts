'use server';

import { requireRole } from '@/lib/auth/require-role';
import { SurveyCreateSchema, SurveyUpdateSchema, parseComplications } from '@/lib/schemas/survey';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

const SURVEY_ROLES = ['surveyor', 'manager', 'admin', 'super_admin'] as const;
const DELETE_ROLES = ['manager', 'admin', 'super_admin'] as const;

export type SurveyActionState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'ok' };

export const INITIAL_SURVEY_STATE: SurveyActionState = { status: 'idle' };

export async function createSurvey(
  _prev: SurveyActionState,
  form: FormData,
): Promise<SurveyActionState> {
  const me = await requireRole(SURVEY_ROLES);

  const parsed = SurveyCreateSchema.safeParse({
    job_id: form.get('job_id'),
    survey_type: form.get('survey_type'),
    scheduled_at: form.get('scheduled_at') || undefined,
    completed: form.get('completed') || undefined,
    cubic_ft_estimate: form.get('cubic_ft_estimate') || undefined,
    cubic_ft_confidence: form.get('cubic_ft_confidence') || undefined,
    notes_internal: form.get('notes_internal') || undefined,
    notes_for_customer: form.get('notes_for_customer') || undefined,
    source_video_url: form.get('source_video_url') || undefined,
  });
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('surveys')
    .insert({
      company_id: me.company_id,
      job_id: parsed.data.job_id,
      surveyor_id: me.id,
      survey_type: parsed.data.survey_type,
      scheduled_at: parsed.data.scheduled_at ?? null,
      completed_at: parsed.data.completed ? new Date().toISOString() : null,
      cubic_ft_estimate: parsed.data.cubic_ft_estimate ?? null,
      cubic_ft_confidence: parsed.data.cubic_ft_confidence ?? null,
      complications: parseComplications(form.get('complications')),
      notes_internal: parsed.data.notes_internal ?? null,
      notes_for_customer: parsed.data.notes_for_customer ?? null,
      source_video_url: parsed.data.source_video_url ?? null,
    })
    .select('id')
    .single();
  if (error || !data) return { status: 'error', message: 'Could not create the survey' };

  revalidatePath(`/dashboard/jobs/${parsed.data.job_id}/surveys`);
  redirect(`/dashboard/jobs/${parsed.data.job_id}/surveys/${(data as { id: string }).id}`);
}

export async function updateSurvey(
  _prev: SurveyActionState,
  form: FormData,
): Promise<SurveyActionState> {
  await requireRole(SURVEY_ROLES);

  const parsed = SurveyUpdateSchema.safeParse({
    id: form.get('id'),
    version: form.get('version'),
    survey_type: form.get('survey_type'),
    scheduled_at: form.get('scheduled_at') || undefined,
    completed: form.get('completed') || undefined,
    cubic_ft_estimate: form.get('cubic_ft_estimate') || undefined,
    cubic_ft_confidence: form.get('cubic_ft_confidence') || undefined,
    notes_internal: form.get('notes_internal') || undefined,
    notes_for_customer: form.get('notes_for_customer') || undefined,
    source_video_url: form.get('source_video_url') || undefined,
  });
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from('surveys')
    .select('job_id, completed_at, version')
    .eq('id', parsed.data.id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!existing) return { status: 'error', message: 'Survey not found' };
  const row = existing as { job_id: string; completed_at: string | null; version: number };
  if (row.version !== parsed.data.version) {
    return { status: 'error', message: 'This survey changed elsewhere. Reload and retry.' };
  }

  // Stamp completed_at on first completion; clear it if unchecked.
  const completedAt = parsed.data.completed ? (row.completed_at ?? new Date().toISOString()) : null;

  const { data: saved, error } = await supabase
    .from('surveys')
    .update({
      survey_type: parsed.data.survey_type,
      scheduled_at: parsed.data.scheduled_at ?? null,
      completed_at: completedAt,
      cubic_ft_estimate: parsed.data.cubic_ft_estimate ?? null,
      cubic_ft_confidence: parsed.data.cubic_ft_confidence ?? null,
      complications: parseComplications(form.get('complications')),
      notes_internal: parsed.data.notes_internal ?? null,
      notes_for_customer: parsed.data.notes_for_customer ?? null,
      source_video_url: parsed.data.source_video_url ?? null,
      version: parsed.data.version + 1,
    })
    .eq('id', parsed.data.id)
    .eq('version', parsed.data.version)
    .select('id')
    .maybeSingle();
  if (error || !saved)
    return { status: 'error', message: 'Could not update the survey. Reload and retry.' };

  revalidatePath(`/dashboard/jobs/${row.job_id}/surveys/${parsed.data.id}`);
  revalidatePath(`/dashboard/jobs/${row.job_id}/surveys`);
  return { status: 'ok' };
}

export async function softDeleteSurvey(
  _prev: SurveyActionState,
  form: FormData,
): Promise<SurveyActionState> {
  await requireRole(DELETE_ROLES);
  const id = form.get('id');
  const jobId = form.get('job_id');
  const versionRaw = form.get('version');
  if (typeof id !== 'string' || typeof jobId !== 'string' || typeof versionRaw !== 'string') {
    return { status: 'error', message: 'Missing fields' };
  }
  const version = Number.parseInt(versionRaw, 10);
  if (!Number.isFinite(version)) return { status: 'error', message: 'Invalid version' };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('surveys')
    .update({ deleted_at: new Date().toISOString(), version: version + 1 })
    .eq('id', id)
    .eq('version', version)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle();
  if (error || !data) return { status: 'error', message: 'Could not delete the survey' };

  revalidatePath(`/dashboard/jobs/${jobId}/surveys`);
  redirect(`/dashboard/jobs/${jobId}/surveys`);
}
