'use server';

import { requireRole } from '@/lib/auth/require-role';
import { poundsToPence } from '@/lib/money/pounds';
import { WorkerIdSchema, WorkerSchema, WorkerVersionSchema } from '@/lib/schemas/worker';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

// Workers are contractors managed by managers and admins.
const WORKER_ROLES = ['manager', 'admin', 'super_admin'] as const;

export type WorkerActionState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'ok'; id: string };

const IDLE: WorkerActionState = { status: 'idle' };

// Hourly rate is entered in pounds; the column stores integer pence. Blank stays
// '' (optional); a non-money token passes through so the schema rejects it.
function penceFromPounds(value: FormDataEntryValue | null): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (raw === '') return '';
  const pence = poundsToPence(raw);
  return pence === null ? raw : String(pence);
}

function readPayload(form: FormData) {
  return {
    full_name: form.get('full_name'),
    phone: form.get('phone'),
    email: form.get('email'),
    hourly_rate_pence: penceFromPounds(form.get('hourly_rate_pounds')),
    skills: form.get('skills'),
    active: form.get('active') === 'on',
    notes: form.get('notes'),
  };
}

export async function createWorker(
  _prev: WorkerActionState,
  form: FormData,
): Promise<WorkerActionState> {
  const me = await requireRole(WORKER_ROLES);

  const parsed = WorkerSchema.safeParse(readPayload(form));
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('workers')
    .insert({
      full_name: parsed.data.full_name,
      phone: parsed.data.phone ?? null,
      email: parsed.data.email ?? null,
      hourly_rate_pence: parsed.data.hourly_rate_pence ?? null,
      skills: parsed.data.skills ?? null,
      active: parsed.data.active,
      notes: parsed.data.notes ?? null,
      company_id: me.company_id,
    })
    .select('id')
    .single();
  if (error || !data) return { status: 'error', message: 'Could not create worker' };

  revalidatePath('/dashboard/workers');
  redirect(`/dashboard/workers/${data.id}`);
}

export async function updateWorker(
  _prev: WorkerActionState,
  form: FormData,
): Promise<WorkerActionState> {
  await requireRole(WORKER_ROLES);

  const idResult = WorkerIdSchema.safeParse(form.get('id'));
  const versionResult = WorkerVersionSchema.safeParse(form.get('version'));
  if (!idResult.success || !versionResult.success) {
    return { status: 'error', message: 'Missing id or version' };
  }

  const parsed = WorkerSchema.safeParse(readPayload(form));
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('workers')
    .update({
      full_name: parsed.data.full_name,
      phone: parsed.data.phone ?? null,
      email: parsed.data.email ?? null,
      hourly_rate_pence: parsed.data.hourly_rate_pence ?? null,
      skills: parsed.data.skills ?? null,
      active: parsed.data.active,
      notes: parsed.data.notes ?? null,
      version: versionResult.data + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', idResult.data)
    .eq('version', versionResult.data)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle();

  if (error) return { status: 'error', message: 'Could not update worker' };
  if (!data) {
    return {
      status: 'error',
      message: 'This worker was edited elsewhere. Reload to see the latest.',
    };
  }

  revalidatePath(`/dashboard/workers/${idResult.data}`);
  revalidatePath('/dashboard/workers');
  redirect(`/dashboard/workers/${idResult.data}`);
}

export async function softDeleteWorker(
  _prev: WorkerActionState,
  form: FormData,
): Promise<WorkerActionState> {
  await requireRole(['admin', 'super_admin']);

  const idResult = WorkerIdSchema.safeParse(form.get('id'));
  const versionResult = WorkerVersionSchema.safeParse(form.get('version'));
  if (!idResult.success || !versionResult.success) {
    return { status: 'error', message: 'Missing id or version' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('workers')
    .update({ deleted_at: new Date().toISOString(), version: versionResult.data + 1 })
    .eq('id', idResult.data)
    .eq('version', versionResult.data)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle();

  if (error || !data) return { status: 'error', message: 'Could not delete worker' };

  revalidatePath('/dashboard/workers');
  redirect('/dashboard/workers');
}

export { IDLE as INITIAL_WORKER_STATE };
