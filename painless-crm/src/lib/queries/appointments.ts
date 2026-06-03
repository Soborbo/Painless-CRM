import type { CalendarAppointment, CalendarHoliday } from '@/lib/calendar/grid';
import { createClient } from '@/lib/supabase/server';

// Phase 22 — calendar reads. RLS scopes both to the caller's company.

function embedName(raw: unknown): string | null {
  if (Array.isArray(raw)) return (raw[0] as { full_name: string } | undefined)?.full_name ?? null;
  return (raw as { full_name: string } | null)?.full_name ?? null;
}

const APPT_COLUMNS = `
  id, title, category, starts_at, ends_at, job_id, customer_id, assigned_to_id,
  assigned_to:users!appointments_assigned_to_id_fkey (full_name)
`;

// Appointments that start within [fromIso, toIso).
export async function listAppointments(
  fromIso: string,
  toIso: string,
): Promise<CalendarAppointment[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('appointments')
    .select(APPT_COLUMNS)
    .is('deleted_at', null)
    .gte('starts_at', fromIso)
    .lt('starts_at', toIso)
    .order('starts_at', { ascending: true })
    .limit(2000);
  return ((data ?? []) as Array<Record<string, unknown>>).map((raw) => ({
    id: raw.id as string,
    title: raw.title as string,
    category: (raw.category as string | null) ?? 'other',
    starts_at: raw.starts_at as string,
    ends_at: raw.ends_at as string,
    job_id: (raw.job_id as string | null) ?? null,
    customer_id: (raw.customer_id as string | null) ?? null,
    assigned_to_id: (raw.assigned_to_id as string | null) ?? null,
    assigned_to_name: embedName(raw.assigned_to),
  }));
}

const HOLIDAY_COLUMNS = `
  id, worker_id, start_date, end_date, kind,
  worker:workers!staff_holidays_worker_id_fkey (full_name)
`;

// Holidays overlapping [fromYmd, toYmd] (inclusive).
export async function listStaffHolidays(
  fromYmd: string,
  toYmd: string,
): Promise<CalendarHoliday[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('staff_holidays')
    .select(HOLIDAY_COLUMNS)
    .is('deleted_at', null)
    .lte('start_date', toYmd)
    .gte('end_date', fromYmd)
    .order('start_date', { ascending: true })
    .limit(2000);
  return ((data ?? []) as Array<Record<string, unknown>>).map((raw) => {
    const worker = raw.worker;
    const name = Array.isArray(worker)
      ? (worker[0] as { full_name: string } | undefined)?.full_name
      : (worker as { full_name: string } | null)?.full_name;
    return {
      id: raw.id as string,
      worker_id: raw.worker_id as string,
      worker_name: name ?? 'Unknown',
      start_date: raw.start_date as string,
      end_date: raw.end_date as string,
      kind: (raw.kind as string | null) ?? 'holiday',
    };
  });
}
