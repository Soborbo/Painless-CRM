import type { BoardAssignment, LaneOption } from '@/lib/dispatch/board';
import { createClient } from '@/lib/supabase/server';
import { customerDisplayName } from '@/lib/utils/format';

// Phase 20 — Dispatcher board read layer. Pulls every crew/vehicle assignment
// in a date window (joined to its job + worker + vehicle) plus the active
// worker / vehicle lists so empty lanes still render. RLS scopes to the tenant.

function embedOne<T>(raw: unknown): T | null {
  if (Array.isArray(raw)) return (raw[0] as T | undefined) ?? null;
  return (raw as T | null) ?? null;
}

export interface DispatchBoardData {
  assignments: BoardAssignment[];
  staffLanes: LaneOption[];
  vehicleLanes: LaneOption[];
}

type JobEmbed = {
  job_number: string;
  stage: string | null;
  customer: Parameters<typeof customerDisplayName>[0] | null;
};

export async function getDispatchBoardData(
  fromDate: string,
  toDate: string,
): Promise<DispatchBoardData> {
  const supabase = await createClient();

  const [{ data: assignmentRows }, { data: workerRows }, { data: vehicleRows }] = await Promise.all(
    [
      supabase
        .from('job_assignments')
        .select(
          `id, job_id, worker_id, vehicle_id, role, scheduled_start, scheduled_end, date,
         worker:workers (full_name),
         vehicle:vehicles (registration),
         job:jobs!job_assignments_job_id_fkey (
           job_number, stage,
           customer:customers (customer_type, first_name, last_name, company_name, primary_email)
         )`,
        )
        .gte('date', fromDate)
        .lte('date', toDate)
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
    ],
  );

  const assignments: BoardAssignment[] = ((assignmentRows ?? []) as Array<Record<string, unknown>>)
    .map((raw) => {
      const worker = embedOne<{ full_name: string }>(raw.worker);
      const vehicle = embedOne<{ registration: string }>(raw.vehicle);
      const job = embedOne<JobEmbed>(raw.job);
      if (!job) return null;
      return {
        job_id: raw.job_id as string,
        job_number: job.job_number,
        customer_name: job.customer ? customerDisplayName(job.customer) : 'Unknown customer',
        stage: job.stage ?? 'lead',
        date: raw.date as string,
        worker_id: raw.worker_id as string,
        worker_name: worker?.full_name ?? 'Unknown',
        vehicle_id: (raw.vehicle_id as string | null) ?? null,
        vehicle_registration: vehicle?.registration ?? null,
        role: (raw.role as string | null) ?? null,
        scheduled_start: (raw.scheduled_start as string | null) ?? null,
        scheduled_end: (raw.scheduled_end as string | null) ?? null,
      } satisfies BoardAssignment;
    })
    .filter((a): a is BoardAssignment => a !== null);

  return {
    assignments,
    staffLanes: ((workerRows ?? []) as Array<{ id: string; full_name: string }>).map((w) => ({
      id: w.id,
      label: w.full_name,
    })),
    vehicleLanes: ((vehicleRows ?? []) as Array<{ id: string; registration: string }>).map((v) => ({
      id: v.id,
      label: v.registration,
    })),
  };
}
