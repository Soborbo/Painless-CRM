'use server';

import { requireRole } from '@/lib/auth/require-role';
import { resolveMentions } from '@/lib/notes/mentions';
import { createNotifications } from '@/lib/notifications/create';
import { AddJobNoteSchema, SoftDeleteNoteSchema } from '@/lib/schemas/note';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

const NOTE_AUTHOR_ROLES = [
  'sales',
  'manager',
  'admin',
  'super_admin',
  'surveyor',
  'accounts',
] as const;

export type NoteActionState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'ok'; note_id: string };

export const INITIAL_NOTE_ACTION_STATE: NoteActionState = { status: 'idle' };

export async function addJobNote(_prev: NoteActionState, form: FormData): Promise<NoteActionState> {
  const me = await requireRole(NOTE_AUTHOR_ROLES);

  const parsed = AddJobNoteSchema.safeParse({
    job_id: form.get('job_id'),
    body: form.get('body'),
    is_customer_visible: form.get('is_customer_visible'),
  });
  if (!parsed.success) {
    return {
      status: 'error',
      message: parsed.error.issues[0]?.message ?? 'Invalid input',
    };
  }

  const supabase = await createClient();
  const { data: job } = await supabase
    .from('jobs')
    .select('id, job_number')
    .eq('id', parsed.data.job_id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!job) return { status: 'error', message: 'Job not found' };

  // Resolve @mentions against active company users (RLS scopes the read).
  const { data: users } = await supabase
    .from('users')
    .select('id, full_name')
    .eq('active', true);
  const mentions = resolveMentions(parsed.data.body, users ?? []);

  const { data, error } = await supabase
    .from('notes')
    .insert({
      company_id: me.company_id,
      parent_type: 'job',
      parent_id: job.id,
      body: parsed.data.body,
      mentions: mentions.length > 0 ? mentions : null,
      is_customer_visible: parsed.data.is_customer_visible,
      category: parsed.data.is_customer_visible ? 'customer_visible' : 'admin',
      created_by_id: me.id,
    })
    .select('id')
    .single();
  if (error || !data) return { status: 'error', message: 'Could not save note' };

  // Notify the mentioned users (never the author). Best-effort; runs on the
  // admin client inside the helper.
  await createNotifications(
    mentions.filter((id) => id !== me.id),
    {
      companyId: me.company_id,
      type: 'mention',
      title: `${me.full_name} mentioned you on job ${job.job_number}`,
      body: parsed.data.body,
      linkUrl: `/dashboard/jobs/${job.id}`,
      relatedEntityType: 'job',
      relatedEntityId: job.id,
    },
  );

  revalidatePath(`/dashboard/jobs/${parsed.data.job_id}`);
  return { status: 'ok', note_id: data.id as string };
}

export async function softDeleteJobNote(
  _prev: NoteActionState,
  form: FormData,
): Promise<NoteActionState> {
  const me = await requireRole(NOTE_AUTHOR_ROLES);

  const parsed = SoftDeleteNoteSchema.safeParse({
    id: form.get('id'),
    job_id: form.get('job_id'),
  });
  if (!parsed.success) return { status: 'error', message: 'Invalid input' };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('notes')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', parsed.data.id)
    .eq('parent_type', 'job')
    .eq('parent_id', parsed.data.job_id)
    .eq('created_by_id', me.id)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle();
  if (error) return { status: 'error', message: 'Could not delete note' };
  if (!data) return { status: 'error', message: 'Note not found or not yours to delete' };

  revalidatePath(`/dashboard/jobs/${parsed.data.job_id}`);
  return { status: 'ok', note_id: parsed.data.id };
}
