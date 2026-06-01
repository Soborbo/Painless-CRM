'use server';

import { requireRole } from '@/lib/auth/require-role';
import { VehicleIdSchema, VehicleSchema, VehicleVersionSchema } from '@/lib/schemas/vehicle';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

// Vehicles are operational fleet records — managed by managers and admins.
const FLEET_ROLES = ['manager', 'admin', 'super_admin'] as const;

export type VehicleActionState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'ok'; id: string };

const IDLE: VehicleActionState = { status: 'idle' };

// The form collects monthly cost in pounds (user-friendly); the column stores
// integer pence. Convert here so the schema only ever deals in pence.
function poundsToPence(value: FormDataEntryValue | null): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (raw === '') return '';
  const pounds = Number(raw);
  if (!Number.isFinite(pounds)) return raw; // let Zod reject it
  return String(Math.round(pounds * 100));
}

function readPayload(form: FormData) {
  return {
    registration: form.get('registration'),
    type: form.get('type'),
    capacity_cubic_ft: form.get('capacity_cubic_ft') ?? '',
    monthly_cost_pence: poundsToPence(form.get('monthly_cost_pounds')),
    active: form.get('active') === 'on',
    compliance_alerts_enabled: form.get('compliance_alerts_enabled') === 'on',
    mot_due: form.get('mot_due') ?? '',
    tax_due: form.get('tax_due') ?? '',
    insurance_due: form.get('insurance_due') ?? '',
    next_service_due: form.get('next_service_due') ?? '',
  };
}

export async function createVehicle(
  _prev: VehicleActionState,
  form: FormData,
): Promise<VehicleActionState> {
  const me = await requireRole(FLEET_ROLES);

  const parsed = VehicleSchema.safeParse(readPayload(form));
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('vehicles')
    .insert({ ...parsed.data, company_id: me.company_id })
    .select('id')
    .single();

  if (error || !data) {
    const message =
      error?.code === '23505'
        ? 'A vehicle with that registration already exists'
        : 'Could not create vehicle';
    return { status: 'error', message };
  }

  revalidatePath('/dashboard/vehicles');
  redirect(`/dashboard/vehicles/${data.id}`);
}

export async function updateVehicle(
  _prev: VehicleActionState,
  form: FormData,
): Promise<VehicleActionState> {
  await requireRole(FLEET_ROLES);

  const idResult = VehicleIdSchema.safeParse(form.get('id'));
  const versionResult = VehicleVersionSchema.safeParse(form.get('version'));
  if (!idResult.success || !versionResult.success) {
    return { status: 'error', message: 'Missing id or version' };
  }

  const parsed = VehicleSchema.safeParse(readPayload(form));
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('vehicles')
    .update({
      ...parsed.data,
      version: versionResult.data + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', idResult.data)
    .eq('version', versionResult.data)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle();

  if (error) {
    const message =
      error.code === '23505'
        ? 'A vehicle with that registration already exists'
        : 'Could not update vehicle';
    return { status: 'error', message };
  }
  if (!data) {
    return {
      status: 'error',
      message: 'This vehicle was edited elsewhere. Reload to see the latest.',
    };
  }

  revalidatePath(`/dashboard/vehicles/${idResult.data}`);
  revalidatePath('/dashboard/vehicles');
  redirect(`/dashboard/vehicles/${idResult.data}`);
}

export async function softDeleteVehicle(
  _prev: VehicleActionState,
  form: FormData,
): Promise<VehicleActionState> {
  await requireRole(['admin', 'super_admin']);

  const idResult = VehicleIdSchema.safeParse(form.get('id'));
  const versionResult = VehicleVersionSchema.safeParse(form.get('version'));
  if (!idResult.success || !versionResult.success) {
    return { status: 'error', message: 'Missing id or version' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('vehicles')
    .update({ deleted_at: new Date().toISOString(), version: versionResult.data + 1 })
    .eq('id', idResult.data)
    .eq('version', versionResult.data)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle();

  if (error || !data) return { status: 'error', message: 'Could not delete vehicle' };

  revalidatePath('/dashboard/vehicles');
  redirect('/dashboard/vehicles');
}

export { IDLE as INITIAL_VEHICLE_STATE };
