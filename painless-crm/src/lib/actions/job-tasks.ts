'use server';

import { requireRole } from '@/lib/auth/require-role';
import { nextSortOrder } from '@/lib/jobs/tasks';
import { AddJobTaskSchema, DeleteJobTaskSchema, ToggleJobTaskSchema } from '@/lib/schemas/job-task';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

// Phase 19 — job task checklist mutations (ADR-028).

const TASK_ROLES = ['sales', 'manager', 'admin', 'super_admin', 'surveyor', 'accounts'] as const;

export type JobTaskActionState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'ok' };

export const INITIAL_JOB_TASK_STATE: JobTaskActionState = { status: 'idle' };

function jobPath(jobId: string): string {
  return `/dashboard/jobs/${jobId}`;
}

export async function addJobTask(
  _prev: JobTaskActionState,
  form: FormData,
): Promise<JobTaskActionState> {
  const me = await requireRole(TASK_ROLES);

  const parsed = AddJobTaskSchema.safeParse({
    job_id: form.get('job_id'),
    title: form.get('title'),
    due_date: form.get('due_date'),
    assigned_to_id: form.get('assigned_to_id'),
  });
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const supabase = await createClient();
  const { data: job } = await supabase
    .from('jobs')
    .select('id')
    .eq('id', parsed.data.job_id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!job) return { status: 'error', message: 'Job not found' };

  // Append below existing tasks (RLS scopes the read to the tenant).
  const { data: existing } = await supabase
    .from('job_tasks')
    .select('sort_order')
    .eq('job_id', parsed.data.job_id)
    .is('deleted_at', null);
  const sortOrder = nextSortOrder(
    ((existing ?? []) as Array<{ sort_order: number }>).map((r) => ({
      done: false,
      sort_order: r.sort_order,
    })),
  );

  const { error } = await supabase.from('job_tasks').insert({
    company_id: me.company_id,
    job_id: parsed.data.job_id,
    title: parsed.data.title,
    due_date: parsed.data.due_date ?? null,
    assigned_to_id: parsed.data.assigned_to_id ?? null,
    sort_order: sortOrder,
    created_by_id: me.id,
  });
  if (error) return { status: 'error', message: 'Could not add the task' };

  revalidatePath(jobPath(parsed.data.job_id));
  return { status: 'ok' };
}

export async function toggleJobTask(
  _prev: JobTaskActionState,
  form: FormData,
): Promise<JobTaskActionState> {
  await requireRole(TASK_ROLES);

  const parsed = ToggleJobTaskSchema.safeParse({
    id: form.get('id'),
    job_id: form.get('job_id'),
    done: form.get('done'),
  });
  if (!parsed.success) return { status: 'error', message: 'Invalid input' };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('job_tasks')
    .update({
      done: parsed.data.done,
      done_at: parsed.data.done ? new Date().toISOString() : null,
    })
    .eq('id', parsed.data.id)
    .eq('job_id', parsed.data.job_id)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle();
  if (error) return { status: 'error', message: 'Could not update the task' };
  if (!data) return { status: 'error', message: 'Task not found' };

  revalidatePath(jobPath(parsed.data.job_id));
  return { status: 'ok' };
}

export async function deleteJobTask(
  _prev: JobTaskActionState,
  form: FormData,
): Promise<JobTaskActionState> {
  await requireRole(TASK_ROLES);

  const parsed = DeleteJobTaskSchema.safeParse({
    id: form.get('id'),
    job_id: form.get('job_id'),
  });
  if (!parsed.success) return { status: 'error', message: 'Invalid input' };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('job_tasks')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', parsed.data.id)
    .eq('job_id', parsed.data.job_id)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle();
  if (error) return { status: 'error', message: 'Could not delete the task' };
  if (!data) return { status: 'error', message: 'Task not found' };

  revalidatePath(jobPath(parsed.data.job_id));
  return { status: 'ok' };
}
