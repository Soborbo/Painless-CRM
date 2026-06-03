import { createClient } from '@/lib/supabase/server';

// Phase 09 — vehicle-check admin reads. RLS scopes everything to the company.

export interface VehicleCheckListRow {
  id: string;
  date: string;
  submitted_at: string | null;
  registration: string;
  worker_name: string;
  job_number: string | null;
  job_id: string | null;
  fuel_level: number | null;
  mileage: number | null;
  walk_around_clear: boolean | null;
  defects_noted: string | null;
}

const SELECT =
  'id, date, submitted_at, fuel_level, mileage, walk_around_clear, defects_noted, job_id, ' +
  'vehicle:vehicles (registration), worker:workers (full_name), job:jobs (job_number)';

function embedOne<T>(raw: unknown): T | null {
  if (Array.isArray(raw)) return (raw[0] as T | undefined) ?? null;
  return (raw as T | null) ?? null;
}

export async function listRecentVehicleChecks(limit = 100): Promise<VehicleCheckListRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('vehicle_checks')
    .select(SELECT)
    .is('deleted_at', null)
    .order('submitted_at', { ascending: false })
    .limit(limit);

  return ((data ?? []) as unknown as Array<Record<string, unknown>>).map((raw) => {
    const vehicle = embedOne<{ registration: string }>(raw.vehicle);
    const worker = embedOne<{ full_name: string }>(raw.worker);
    const job = embedOne<{ job_number: string }>(raw.job);
    return {
      id: raw.id as string,
      date: raw.date as string,
      submitted_at: (raw.submitted_at as string | null) ?? null,
      registration: vehicle?.registration ?? '—',
      worker_name: worker?.full_name ?? '—',
      job_number: job?.job_number ?? null,
      job_id: (raw.job_id as string | null) ?? null,
      fuel_level: (raw.fuel_level as number | null) ?? null,
      mileage: (raw.mileage as number | null) ?? null,
      walk_around_clear: (raw.walk_around_clear as boolean | null) ?? null,
      defects_noted: (raw.defects_noted as string | null) ?? null,
    };
  });
}
