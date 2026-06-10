import { getWorkerJobDetail } from '@/lib/queries/worker-app';
import type { VehicleCheckInput } from '@/lib/schemas/vehicle-check';
import { createClient } from '@/lib/supabase/server';
import { boundedClientTimestamp } from './client-timestamp';

// Shared persister for the vehicle pre-check. Idempotent via the client_event_id
// dedup index (migration 40). The dashboard photo + signature columns are left
// null here — they arrive with the photo-upload (Storage) slice.

export type PersistVehicleCheckResult = 'ok' | 'not_assigned' | 'error';

export async function persistVehicleCheck(
  worker: { id: string; company_id: string },
  input: VehicleCheckInput,
): Promise<PersistVehicleCheckResult> {
  const today = new Date().toISOString().slice(0, 10);
  const detail = await getWorkerJobDetail(input.job_id, worker.id, today);
  if (!detail) return 'not_assigned';

  const recordedAt = boundedClientTimestamp(input.client_recorded_at);
  const supabase = await createClient();

  // vehicle_id is client-supplied and only UUID-validated; the vehicle_checks
  // RLS WITH CHECK constrains company_id + worker_id but NOT vehicle_id, and the
  // FK only enforces existence. Confirm the vehicle is visible under RLS (i.e.
  // belongs to the worker's company) so a forged/cross-tenant vehicle_id can't
  // be stamped onto a check row (audit M2).
  const { data: vehicle } = await supabase
    .from('vehicles')
    .select('id')
    .eq('id', input.vehicle_id)
    .maybeSingle();
  if (!vehicle) return 'not_assigned';

  const { error } = await supabase.from('vehicle_checks').insert({
    company_id: worker.company_id,
    vehicle_id: input.vehicle_id,
    job_id: input.job_id,
    worker_id: worker.id,
    date: input.date,
    fuel_level: input.fuel_level,
    mileage: input.mileage,
    walk_around_clear: input.walk_around_clear,
    defects_noted: input.defects_noted ?? null,
    client_event_id: input.client_event_id,
    client_recorded_at: recordedAt,
  });

  if (error && error.code !== '23505') return 'error';
  return 'ok';
}
