'use server';

import { requireRole } from '@/lib/auth/require-role';
import { emitEvent } from '@/lib/notifications/emit';
import {
  CompleteTaskSchema,
  CreateTaskSchema,
  DeleteTaskSchema,
  ReassignTaskSchema,
  SnoozeTaskSchema,
  UpdateTaskSchema,
  dueToIso,
} from '@/lib/schemas/task';
import { createClient } from '@/lib/supabase/server';
import { nextSortOrder } from '@/lib/tasks/model';
import { revalidatePath } from 'next/cache';

// Phase 27 — unified task mutations (ADR-042).

const TASK_ROLES = ['sales', 'manager', 'admin', 'super_admin', 'surveyor', 'accounts'] as const;

export type TaskActionState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'ok' };

export const INITIAL_TASK_STATE: TaskActionState = { status: 'idle' };

type Db = Awaited<ReturnType<typeof createClient>>;

interface TaskLocation {
  job_id: string | null;
  customer_id: string | null;
  related_type: string | null;
  related_id: string | null;
}

function revalidateForTask(loc: TaskLocation): void {
  revalidatePath('/dashboard/tasks');
  if (loc.job_id) revalidatePath(`/dashboard/jobs/${loc.job_id}`);
  if (loc.customer_id) revalidatePath(`/dashboard/customers/${loc.customer_id}`);
}

async function loadLocation(supabase: Db, id: string): Promise<TaskLocation | null> {
  const { data } = await supabase
    .from('tasks')
    .select('job_id, customer_id, related_type, related_id')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  return (data as TaskLocation | null) ?? null;
}

async function setAssignees(
  supabase: Db,
  taskId: string,
  companyId: string,
  userIds: readonly string[],
): Promise<void> {
  await supabase.from('task_assignees').delete().eq('task_id', taskId);
  const unique = [...new Set(userIds)];
  if (unique.length === 0) return;
  await supabase
    .from('task_assignees')
    .insert(unique.map((user_id) => ({ task_id: taskId, user_id, company_id: companyId })));
}

async function notifyAssignees(
  companyId: string,
  taskId: string,
  title: string,
  jobId: string | null,
  recipients: readonly string[],
  actorId: string,
): Promise<void> {
  const link = jobId ? `/dashboard/jobs/${jobId}` : '/dashboard/tasks';
  for (const recipientUserId of new Set(recipients)) {
    if (recipientUserId === actorId) continue;
    await emitEvent({
      companyId,
      eventKey: 'task.assigned',
      title,
      linkUrl: link,
      relatedEntityType: 'task',
      relatedEntityId: taskId,
      recipientUserId,
    });
  }
}

export async function createTask(
  _prev: TaskActionState,
  form: FormData,
): Promise<TaskActionState> {
  const me = await requireRole(TASK_ROLES);
  const parsed = CreateTaskSchema.safeParse({
    title: form.get('title'),
    description: form.get('description'),
    kind: form.get('kind') ?? undefined,
    priority: form.get('priority') ?? undefined,
    due_at: form.get('due_at'),
    related_type: form.get('related_type'),
    related_id: form.get('related_id'),
    customer_id: form.get('customer_id'),
    job_id: form.get('job_id'),
    assigned_to_ids: form.getAll('assigned_to_ids').filter((v) => typeof v === 'string' && v),
  });
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }
  const d = parsed.data;
  const supabase = await createClient();

  let sortOrder = 0;
  if (d.kind === 'checklist' && d.job_id) {
    const { data: existing } = await supabase
      .from('tasks')
      .select('sort_order')
      .eq('job_id', d.job_id)
      .eq('kind', 'checklist')
      .is('deleted_at', null);
    sortOrder = nextSortOrder((existing ?? []) as Array<{ sort_order: number }>);
  }

  const { data: inserted, error } = await supabase
    .from('tasks')
    .insert({
      company_id: me.company_id,
      related_type: d.related_type ?? null,
      related_id: d.related_id ?? null,
      customer_id: d.customer_id ?? null,
      job_id: d.job_id ?? null,
      kind: d.kind,
      title: d.title,
      description: d.description ?? null,
      priority: d.priority,
      due_at: dueToIso(d.due_at),
      sort_order: sortOrder,
      created_by_id: me.id,
    })
    .select('id')
    .single();
  if (error || !inserted) return { status: 'error', message: 'Could not add the task' };

  const taskId = (inserted as { id: string }).id;
  await setAssignees(supabase, taskId, me.company_id, d.assigned_to_ids);
  await notifyAssignees(me.company_id, taskId, d.title, d.job_id ?? null, d.assigned_to_ids, me.id);

  revalidateForTask({
    job_id: d.job_id ?? null,
    customer_id: d.customer_id ?? null,
    related_type: d.related_type ?? null,
    related_id: d.related_id ?? null,
  });
  return { status: 'ok' };
}

export async function completeTask(
  _prev: TaskActionState,
  form: FormData,
): Promise<TaskActionState> {
  const me = await requireRole(TASK_ROLES);
  const parsed = CompleteTaskSchema.safeParse({ id: form.get('id'), done: form.get('done') });
  if (!parsed.success) return { status: 'error', message: 'Invalid input' };
  const supabase = await createClient();
  const loc = await loadLocation(supabase, parsed.data.id);
  if (!loc) return { status: 'error', message: 'Task not found' };

  const done = parsed.data.done;
  const { error } = await supabase
    .from('tasks')
    .update({
      status: done ? 'done' : 'open',
      completed_at: done ? new Date().toISOString() : null,
      completed_by_id: done ? me.id : null,
    })
    .eq('id', parsed.data.id)
    .is('deleted_at', null);
  if (error) return { status: 'error', message: 'Could not update the task' };

  revalidateForTask(loc);
  return { status: 'ok' };
}

export async function updateTask(
  _prev: TaskActionState,
  form: FormData,
): Promise<TaskActionState> {
  const me = await requireRole(TASK_ROLES);
  const parsed = UpdateTaskSchema.safeParse({
    id: form.get('id'),
    title: form.get('title') ?? undefined,
    description: form.get('description'),
    kind: form.get('kind') ?? undefined,
    priority: form.get('priority') ?? undefined,
    status: form.get('status') ?? undefined,
    due_at: form.get('due_at'),
  });
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }
  const d = parsed.data;
  const supabase = await createClient();
  const loc = await loadLocation(supabase, d.id);
  if (!loc) return { status: 'error', message: 'Task not found' };

  const patch: Record<string, unknown> = {};
  if (d.title !== undefined) patch.title = d.title;
  if (d.description !== undefined) patch.description = d.description;
  if (d.kind !== undefined) patch.kind = d.kind;
  if (d.priority !== undefined) patch.priority = d.priority;
  if (d.due_at !== undefined) patch.due_at = dueToIso(d.due_at);
  if (d.status !== undefined) {
    patch.status = d.status;
    patch.completed_at = d.status === 'done' ? new Date().toISOString() : null;
    patch.completed_by_id = d.status === 'done' ? me.id : null;
  }

  const { error } = await supabase
    .from('tasks')
    .update(patch)
    .eq('id', d.id)
    .is('deleted_at', null);
  if (error) return { status: 'error', message: 'Could not update the task' };

  revalidateForTask(loc);
  return { status: 'ok' };
}

export async function reassignTask(
  _prev: TaskActionState,
  form: FormData,
): Promise<TaskActionState> {
  const me = await requireRole(TASK_ROLES);
  const parsed = ReassignTaskSchema.safeParse({
    id: form.get('id'),
    assigned_to_ids: form.getAll('assigned_to_ids').filter((v) => typeof v === 'string' && v),
  });
  if (!parsed.success) return { status: 'error', message: 'Invalid input' };
  const supabase = await createClient();
  const loc = await loadLocation(supabase, parsed.data.id);
  if (!loc) return { status: 'error', message: 'Task not found' };

  await setAssignees(supabase, parsed.data.id, me.company_id, parsed.data.assigned_to_ids);
  revalidateForTask(loc);
  return { status: 'ok' };
}

export async function snoozeTask(
  _prev: TaskActionState,
  form: FormData,
): Promise<TaskActionState> {
  await requireRole(TASK_ROLES);
  const parsed = SnoozeTaskSchema.safeParse({ id: form.get('id'), due_at: form.get('due_at') });
  if (!parsed.success) return { status: 'error', message: 'Invalid input' };
  const supabase = await createClient();
  const loc = await loadLocation(supabase, parsed.data.id);
  if (!loc) return { status: 'error', message: 'Task not found' };

  const { error } = await supabase
    .from('tasks')
    .update({ due_at: dueToIso(parsed.data.due_at) })
    .eq('id', parsed.data.id)
    .is('deleted_at', null);
  if (error) return { status: 'error', message: 'Could not reschedule the task' };

  revalidateForTask(loc);
  return { status: 'ok' };
}

export async function deleteTask(
  _prev: TaskActionState,
  form: FormData,
): Promise<TaskActionState> {
  await requireRole(TASK_ROLES);
  const parsed = DeleteTaskSchema.safeParse({ id: form.get('id') });
  if (!parsed.success) return { status: 'error', message: 'Invalid input' };
  const supabase = await createClient();
  const loc = await loadLocation(supabase, parsed.data.id);
  if (!loc) return { status: 'error', message: 'Task not found' };

  const { error } = await supabase
    .from('tasks')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', parsed.data.id)
    .is('deleted_at', null);
  if (error) return { status: 'error', message: 'Could not delete the task' };

  revalidateForTask(loc);
  return { status: 'ok' };
}
