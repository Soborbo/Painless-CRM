import { boundedClientTimestamp } from './client-timestamp';
import { getGpsThresholdForCompany, getWorkerJobDetail } from '@/lib/queries/worker-app';
import type { ClockInInput } from '@/lib/schemas/clock-in';
import { createClient } from '@/lib/supabase/server';
import { computeClockInGeo } from '@/lib/worker/clock-in';

// Shared clock-in persister (Phase 09). Used by both the server action (online
// form submit) and the API route (offline-queue replay). Idempotent: replaying
// the same client_event_id hits the migration-40 dedup index (23505) and is
// treated as success, so the offline queue can retry safely.

export type PersistClockInResult = 'ok' | 'not_assigned' | 'error';

export async function persistClockIn(
  worker: { id: string; company_id: string },
  input: ClockInInput,
): Promise<PersistClockInResult> {
  const today = new Date().toISOString().slice(0, 10);
  const detail = await getWorkerJobDetail(input.job_id, worker.id, today);
  if (!detail) return 'not_assigned';

  const threshold = await getGpsThresholdForCompany(worker.company_id);
  const geo = computeClockInGeo({
    gpsLat: input.gps_lat,
    gpsLng: input.gps_lng,
    jobLat: detail.from_lat,
    jobLng: detail.from_lng,
    thresholdM: threshold,
  });

  const recordedAt = boundedClientTimestamp(input.client_recorded_at);
  const supabase = await createClient();
  const { error } = await supabase.from('time_entries').insert({
    company_id: worker.company_id,
    job_id: input.job_id,
    worker_id: worker.id,
    type: 'clock_in',
    occurred_at: recordedAt,
    client_event_id: input.client_event_id,
    client_recorded_at: recordedAt,
    gps_lat: input.gps_lat,
    gps_lng: input.gps_lng,
    gps_accuracy_m: input.gps_accuracy_m,
    distance_from_job_address_m: geo.distanceM,
    flagged: geo.flagged,
  });

  // 23505 = dedup index already has this event (a replayed clock-in) → success.
  if (error && error.code !== '23505') return 'error';
  return 'ok';
}
