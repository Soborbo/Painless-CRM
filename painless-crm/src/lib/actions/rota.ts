'use server';

import { requireRole } from '@/lib/auth/require-role';
import { getAssignmentSlotsForDate, getRotaDay, getWorkerLoadsForRange } from '@/lib/queries/rota';
import { LOAD_WINDOW_DAYS, pickNextWorker } from '@/lib/rota/auto-assign';
import { findWorkerConflict } from '@/lib/rota/conflicts';
import { addDaysYmd } from '@/lib/rota/dates';
import {
  AssignmentIdSchema,
  AssignmentVersionSchema,
  AutoAssignSchema,
  JobAssignmentSchema,
} from '@/lib/schemas/job-assignment';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

const ROTA_ROLES = ['manager', 'admin', 'super_admin'] as const;

export type RotaActionState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'ok' };

function dayPath(date: string) {
  return `/dashboard/rota/${date}`;
}

export async function assignWorker(
  _prev: RotaActionState,
  form: FormData,
): Promise<RotaActionState> {
  const me = await requireRole(ROTA_ROLES);

  const parsed = JobAssignmentSchema.safeParse({
    job_id: form.get('job_id'),
    worker_id: form.get('worker_id'),
    vehicle_id: form.get('vehicle_id'),
    date: form.get('date'),
    role: form.get('role'),
    scheduled_start: form.get('scheduled_start'),
    scheduled_end: form.get('scheduled_end'),
    notes: form.get('notes'),
  });
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }
  const data = parsed.data;

  // Conflict guard: a worker can't be on two jobs at once (Phase 08 acceptance).
  const existing = await getAssignmentSlotsForDate(data.date);
  const clash = findWorkerConflict(
    {
      job_id: data.job_id,
      worker_id: data.worker_id,
      date: data.date,
      scheduled_start: data.scheduled_start ?? null,
      scheduled_end: data.scheduled_end ?? null,
    },
    existing,
  );
  if (clash) {
    return { status: 'error', message: 'That worker is already assigned at this time.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('job_assignments').insert({
    company_id: me.company_id,
    job_id: data.job_id,
    worker_id: data.worker_id,
    vehicle_id: data.vehicle_id ?? null,
    date: data.date,
    role: data.role ?? null,
    scheduled_start: data.scheduled_start ?? null,
    scheduled_end: data.scheduled_end ?? null,
    notes: data.notes ?? null,
  });
  if (error) return { status: 'error', message: 'Could not save the assignment' };

  revalidatePath(dayPath(data.date));
  redirect(dayPath(data.date));
}

export async function autoAssignWorker(
  _prev: RotaActionState,
  form: FormData,
): Promise<RotaActionState> {
  const me = await requireRole(ROTA_ROLES);

  const parsed = AutoAssignSchema.safeParse({
    job_id: form.get('job_id'),
    date: form.get('date'),
  });
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }
  const { job_id, date } = parsed.data;

  const day = await getRotaDay(date);
  if (day.workers.length === 0) {
    return { status: 'error', message: 'No active crew to assign.' };
  }

  // An auto-assigned slot is all-day (no time window), so it can't coexist with
  // any other booking that worker already holds that day — on this job or
  // another. Treat everyone already booked that date as unavailable, which both
  // honours the conflict rule and stops auto-assign re-picking the same crew.
  const slots = await getAssignmentSlotsForDate(date);
  const unavailable = new Set(slots.map((s) => s.worker_id));

  const loads = await getWorkerLoadsForRange(date, addDaysYmd(date, LOAD_WINDOW_DAYS - 1));
  const candidate = pickNextWorker(
    day.workers.map((w) => ({ id: w.id, full_name: w.label })),
    day.workers.map((w) => ({ worker_id: w.id, count: loads.get(w.id) ?? 0 })),
    unavailable,
  );
  if (!candidate) {
    return { status: 'error', message: 'Every crew member is already booked that day.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('job_assignments').insert({
    company_id: me.company_id,
    job_id,
    worker_id: candidate.id,
    date,
    role: 'loader',
  });
  if (error) return { status: 'error', message: 'Could not auto-assign a crew member' };

  revalidatePath(dayPath(date));
  redirect(dayPath(date));
}

export async function removeAssignment(
  _prev: RotaActionState,
  form: FormData,
): Promise<RotaActionState> {
  await requireRole(ROTA_ROLES);

  const idResult = AssignmentIdSchema.safeParse(form.get('id'));
  const versionResult = AssignmentVersionSchema.safeParse(form.get('version'));
  const date = form.get('date')?.toString() ?? '';
  if (!idResult.success || !versionResult.success) {
    return { status: 'error', message: 'Missing id or version' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('job_assignments')
    .update({
      deleted_at: new Date().toISOString(),
      version: versionResult.data + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', idResult.data)
    .eq('version', versionResult.data)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle();
  if (error || !data) return { status: 'error', message: 'Could not remove the assignment' };

  revalidatePath(dayPath(date));
  redirect(dayPath(date));
}
