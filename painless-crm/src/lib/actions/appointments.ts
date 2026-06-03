'use server';

import { requireRole } from '@/lib/auth/require-role';
import {
  AppointmentSchema,
  DeleteByIdSchema,
  StaffHolidaySchema,
  datetimeLocalToIso,
} from '@/lib/schemas/appointment';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

// Phase 22 — appointment + staff-holiday mutations (ADR-031). Manager+.

const ROLES = ['manager', 'admin', 'super_admin'] as const;
const PAGE = '/dashboard/calendar';

export type CalendarActionState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'ok' };

export const INITIAL_CALENDAR_STATE: CalendarActionState = { status: 'idle' };

export async function createAppointment(
  _prev: CalendarActionState,
  form: FormData,
): Promise<CalendarActionState> {
  const me = await requireRole(ROLES);

  const parsed = AppointmentSchema.safeParse({
    title: form.get('title'),
    category: form.get('category'),
    starts_at: form.get('starts_at'),
    ends_at: form.get('ends_at'),
    job_id: form.get('job_id'),
    customer_id: form.get('customer_id'),
    assigned_to_id: form.get('assigned_to_id'),
    notes: form.get('notes'),
  });
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('appointments').insert({
    company_id: me.company_id,
    title: parsed.data.title,
    category: parsed.data.category,
    starts_at: datetimeLocalToIso(parsed.data.starts_at),
    ends_at: datetimeLocalToIso(parsed.data.ends_at),
    job_id: parsed.data.job_id ?? null,
    customer_id: parsed.data.customer_id ?? null,
    assigned_to_id: parsed.data.assigned_to_id ?? null,
    notes: parsed.data.notes ?? null,
    created_by_id: me.id,
  });
  if (error) return { status: 'error', message: 'Could not save the appointment' };

  revalidatePath(PAGE);
  return { status: 'ok' };
}

export async function createStaffHoliday(
  _prev: CalendarActionState,
  form: FormData,
): Promise<CalendarActionState> {
  const me = await requireRole(ROLES);

  const parsed = StaffHolidaySchema.safeParse({
    worker_id: form.get('worker_id'),
    start_date: form.get('start_date'),
    end_date: form.get('end_date'),
    kind: form.get('kind'),
    notes: form.get('notes'),
  });
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('staff_holidays').insert({
    company_id: me.company_id,
    worker_id: parsed.data.worker_id,
    start_date: parsed.data.start_date,
    end_date: parsed.data.end_date,
    kind: parsed.data.kind,
    notes: parsed.data.notes ?? null,
    created_by_id: me.id,
  });
  if (error) return { status: 'error', message: 'Could not save the holiday' };

  revalidatePath(PAGE);
  return { status: 'ok' };
}

async function softDelete(
  table: 'appointments' | 'staff_holidays',
  form: FormData,
): Promise<CalendarActionState> {
  await requireRole(ROLES);
  const parsed = DeleteByIdSchema.safeParse({ id: form.get('id') });
  if (!parsed.success) return { status: 'error', message: 'Invalid input' };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from(table)
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', parsed.data.id)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle();
  if (error) return { status: 'error', message: 'Could not delete' };
  if (!data) return { status: 'error', message: 'Not found' };

  revalidatePath(PAGE);
  return { status: 'ok' };
}

export async function deleteAppointment(
  _prev: CalendarActionState,
  form: FormData,
): Promise<CalendarActionState> {
  return softDelete('appointments', form);
}

export async function deleteStaffHoliday(
  _prev: CalendarActionState,
  form: FormData,
): Promise<CalendarActionState> {
  return softDelete('staff_holidays', form);
}
