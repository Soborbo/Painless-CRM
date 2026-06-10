import type { AssignmentSlot } from '@/lib/rota/conflicts';
import { createClient } from '@/lib/supabase/server';
import { customerDisplayName } from '@/lib/utils/format';

// Phase 08 §Rota read layer. The day view needs the jobs scheduled on a date,
// the assignments against them, and the worker/vehicle option lists for the
// assign form. The index needs per-day job counts across a window.

function embedOne<T>(raw: unknown): T | null {
  if (Array.isArray(raw)) return (raw[0] as T | undefined) ?? null;
  return (raw as T | null) ?? null;
}

export type RotaJob = {
  id: string;
  job_number: string;
  customer_name: string;
};

export type RotaAssignment = {
  id: string;
  job_id: string;
  worker_id: string;
  worker_name: string;
  vehicle_id: string | null;
  vehicle_registration: string | null;
  role: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  notes: string | null;
  version: number;
};

export type Option = { id: string; label: string };

export type RotaDay = {
  jobs: RotaJob[];
  assignmentsByJob: Map<string, RotaAssignment[]>;
  workers: Option[];
  vehicles: Option[];
};

const SCHEDULED_STAGES = ['confirmed', 'in_progress'];

export async function getRotaDay(date: string): Promise<RotaDay> {
  const supabase = await createClient();

  const [{ data: jobRows }, { data: assignmentRows }, { data: workerRows }, { data: vehicleRows }] =
    await Promise.all([
      supabase
        .from('jobs')
        .select(
          'id, job_number, customer:customers (customer_type, first_name, last_name, company_name, primary_email)',
        )
        .is('deleted_at', null)
        .in('stage', SCHEDULED_STAGES)
        .eq('move_date', date)
        .order('job_number', { ascending: true }),
      supabase
        .from('job_assignments')
        .select(
          'id, job_id, worker_id, vehicle_id, role, scheduled_start, scheduled_end, notes, version, worker:workers (full_name), vehicle:vehicles (registration)',
        )
        .eq('date', date)
        .is('deleted_at', null),
      supabase
        .from('workers')
        .select('id, full_name')
        .is('deleted_at', null)
        .eq('active', true)
        .order('full_name', { ascending: true }),
      supabase
        .from('vehicles')
        .select('id, registration')
        .is('deleted_at', null)
        .eq('active', true)
        .order('registration', { ascending: true }),
    ]);

  const jobs: RotaJob[] = ((jobRows ?? []) as Array<Record<string, unknown>>).map((raw) => {
    const customer = embedOne<Parameters<typeof customerDisplayName>[0]>(raw.customer);
    return {
      id: raw.id as string,
      job_number: raw.job_number as string,
      customer_name: customer ? customerDisplayName(customer) : 'Unknown customer',
    };
  });

  const assignmentsByJob = new Map<string, RotaAssignment[]>();
  for (const raw of (assignmentRows ?? []) as Array<Record<string, unknown>>) {
    const worker = embedOne<{ full_name: string }>(raw.worker);
    const vehicle = embedOne<{ registration: string }>(raw.vehicle);
    const a: RotaAssignment = {
      id: raw.id as string,
      job_id: raw.job_id as string,
      worker_id: raw.worker_id as string,
      worker_name: worker?.full_name ?? 'Unknown',
      vehicle_id: (raw.vehicle_id as string | null) ?? null,
      vehicle_registration: vehicle?.registration ?? null,
      role: (raw.role as string | null) ?? null,
      scheduled_start: (raw.scheduled_start as string | null) ?? null,
      scheduled_end: (raw.scheduled_end as string | null) ?? null,
      notes: (raw.notes as string | null) ?? null,
      version: raw.version as number,
    };
    const list = assignmentsByJob.get(a.job_id) ?? [];
    list.push(a);
    assignmentsByJob.set(a.job_id, list);
  }

  return {
    jobs,
    assignmentsByJob,
    workers: ((workerRows ?? []) as Array<{ id: string; full_name: string }>).map((w) => ({
      id: w.id,
      label: w.full_name,
    })),
    vehicles: ((vehicleRows ?? []) as Array<{ id: string; registration: string }>).map((v) => ({
      id: v.id,
      label: v.registration,
    })),
  };
}

export type JobScheduleEntry = RotaAssignment & { date: string };

// Job-detail Schedule panel — every crew/vehicle slot booked against one job,
// across all dates (multi-day moves render one row per slot per day).
export async function listAssignmentsForJob(jobId: string): Promise<JobScheduleEntry[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('job_assignments')
    .select(
      'id, job_id, worker_id, vehicle_id, role, date, scheduled_start, scheduled_end, notes, version, worker:workers (full_name), vehicle:vehicles (registration)',
    )
    .eq('job_id', jobId)
    .is('deleted_at', null)
    .order('date', { ascending: true })
    .order('scheduled_start', { ascending: true, nullsFirst: true });
  return ((data ?? []) as Array<Record<string, unknown>>).map((raw) => {
    const worker = embedOne<{ full_name: string }>(raw.worker);
    const vehicle = embedOne<{ registration: string }>(raw.vehicle);
    return {
      id: raw.id as string,
      job_id: raw.job_id as string,
      date: raw.date as string,
      worker_id: raw.worker_id as string,
      worker_name: worker?.full_name ?? 'Unknown',
      vehicle_id: (raw.vehicle_id as string | null) ?? null,
      vehicle_registration: vehicle?.registration ?? null,
      role: (raw.role as string | null) ?? null,
      scheduled_start: (raw.scheduled_start as string | null) ?? null,
      scheduled_end: (raw.scheduled_end as string | null) ?? null,
      notes: (raw.notes as string | null) ?? null,
      version: raw.version as number,
    };
  });
}

// Every assignment slot on a date, for the conflict check in the action.
export async function getAssignmentSlotsForDate(date: string): Promise<AssignmentSlot[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('job_assignments')
    .select('job_id, worker_id, scheduled_start, scheduled_end')
    .eq('date', date)
    .is('deleted_at', null);
  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    job_id: r.job_id as string,
    worker_id: r.worker_id as string,
    date,
    scheduled_start: (r.scheduled_start as string | null) ?? null,
    scheduled_end: (r.scheduled_end as string | null) ?? null,
  }));
}

export type DayCount = { date: string; jobCount: number };

// Per-day scheduled-job counts across [fromDate, toDate], for the rota index.
export async function getRotaJobCounts(
  fromDate: string,
  toDate: string,
): Promise<Map<string, number>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('jobs')
    .select('move_date')
    .is('deleted_at', null)
    .in('stage', SCHEDULED_STAGES)
    .gte('move_date', fromDate)
    .lte('move_date', toDate);
  const counts = new Map<string, number>();
  for (const row of (data ?? []) as Array<{ move_date: string | null }>) {
    if (!row.move_date) continue;
    counts.set(row.move_date, (counts.get(row.move_date) ?? 0) + 1);
  }
  return counts;
}
