'use server';

import { requireRole } from '@/lib/auth/require-role';
import { markEntityDirty } from '@/lib/integrations/google-calendar/dirty';
import { syncEntityCalendar } from '@/lib/integrations/google-calendar/sync';
import { CreateBriefItemSchema, DeleteBriefItemSchema } from '@/lib/schemas/job-brief';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

// Phase 28 (ADR-045) — the office "Move brief" editors: the kit / "not going"
// lists (job_brief_items) plus a manual "Sync now" push. Every mutation flags
// the move dirty so the brief change reaches the calendar.

const BRIEF_ROLES = ['sales', 'surveyor', 'manager', 'admin', 'super_admin'] as const;

export type BriefActionState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'ok'; message?: string };

export const INITIAL_BRIEF_STATE: BriefActionState = { status: 'idle' };

export async function addBriefItem(
  _prev: BriefActionState,
  form: FormData,
): Promise<BriefActionState> {
  const me = await requireRole(BRIEF_ROLES);

  const parsed = CreateBriefItemSchema.safeParse({
    job_id: form.get('job_id'),
    kind: form.get('kind'),
    item: form.get('item'),
    quantity: form.get('quantity') || undefined,
    notes: form.get('notes') || undefined,
  });
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('job_brief_items').insert({
    company_id: me.company_id,
    job_id: parsed.data.job_id,
    kind: parsed.data.kind,
    item: parsed.data.item,
    quantity: parsed.data.quantity,
    notes: parsed.data.notes ?? null,
  });
  if (error) return { status: 'error', message: 'Could not add the item' };

  await markEntityDirty('job_move', parsed.data.job_id, me.company_id);
  revalidatePath(`/dashboard/jobs/${parsed.data.job_id}`);
  return { status: 'ok' };
}

export async function removeBriefItem(
  _prev: BriefActionState,
  form: FormData,
): Promise<BriefActionState> {
  const me = await requireRole(BRIEF_ROLES);
  const jobId = form.get('job_id');
  const parsed = DeleteBriefItemSchema.safeParse({ id: form.get('id') });
  if (!parsed.success || typeof jobId !== 'string') {
    return { status: 'error', message: 'Missing fields' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('job_brief_items')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', parsed.data.id)
    .eq('job_id', jobId)
    .is('deleted_at', null);
  if (error) return { status: 'error', message: 'Could not remove the item' };

  await markEntityDirty('job_move', jobId, me.company_id);
  revalidatePath(`/dashboard/jobs/${jobId}`);
  return { status: 'ok' };
}

export async function syncJobCalendar(
  _prev: BriefActionState,
  form: FormData,
): Promise<BriefActionState> {
  await requireRole(BRIEF_ROLES);
  const jobId = form.get('job_id');
  if (typeof jobId !== 'string') return { status: 'error', message: 'Missing job' };

  // Confirm the job is in the caller's tenant (RLS) before the admin-client push.
  const supabase = await createClient();
  const { data: job } = await supabase
    .from('jobs')
    .select('id')
    .eq('id', jobId)
    .is('deleted_at', null)
    .maybeSingle();
  if (!job) return { status: 'error', message: 'Job not found' };

  const result = await syncEntityCalendar('job_move', jobId);
  revalidatePath(`/dashboard/jobs/${jobId}`);
  if (!result.ok) {
    const notConfigured = result.reason === 'no_credentials' || result.reason === 'no_calendar';
    return {
      status: 'error',
      message: notConfigured ? 'Calendar is not configured yet' : 'Could not sync',
    };
  }
  return { status: 'ok', message: result.action };
}
