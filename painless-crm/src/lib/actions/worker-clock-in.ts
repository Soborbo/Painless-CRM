'use server';

import { requireRole } from '@/lib/auth/require-role';
import {
  getGpsThresholdForCompany,
  getWorkerForUser,
  getWorkerJobDetail,
} from '@/lib/queries/worker-app';
import { ClockInSchema } from '@/lib/schemas/clock-in';
import { createClient } from '@/lib/supabase/server';
import { computeClockInGeo } from '@/lib/worker/clock-in';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

// Worker roles plus office roles (so managers can test/demo the PWA).
const WORKER_APP_ROLES = ['loader', 'surveyor', 'manager', 'admin', 'super_admin'] as const;

export type ClockInState = { status: 'idle' } | { status: 'error'; message: string };

const IDLE: ClockInState = { status: 'idle' };

export async function clockIn(_prev: ClockInState, form: FormData): Promise<ClockInState> {
  const me = await requireRole(WORKER_APP_ROLES);
  const worker = await getWorkerForUser(me.id);
  if (!worker) {
    return { status: 'error', message: 'No worker profile is linked to your account.' };
  }

  const parsed = ClockInSchema.safeParse({
    job_id: form.get('job_id'),
    client_event_id: form.get('client_event_id'),
    gps_lat: form.get('gps_lat') ?? '',
    gps_lng: form.get('gps_lng') ?? '',
    gps_accuracy_m: form.get('gps_accuracy_m') ?? '',
    client_recorded_at: form.get('client_recorded_at'),
  });
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }
  const data = parsed.data;

  const today = new Date().toISOString().slice(0, 10);
  const detail = await getWorkerJobDetail(data.job_id, worker.id, today);
  if (!detail) {
    return { status: 'error', message: 'You are not assigned to this job.' };
  }

  const threshold = await getGpsThresholdForCompany(worker.company_id);
  const geo = computeClockInGeo({
    gpsLat: data.gps_lat,
    gpsLng: data.gps_lng,
    jobLat: detail.from_lat,
    jobLng: detail.from_lng,
    thresholdM: threshold,
  });

  const recordedAt = data.client_recorded_at ?? new Date().toISOString();
  const supabase = await createClient();
  const { error } = await supabase.from('time_entries').insert({
    company_id: worker.company_id,
    job_id: data.job_id,
    worker_id: worker.id,
    type: 'clock_in',
    occurred_at: recordedAt,
    client_event_id: data.client_event_id,
    client_recorded_at: recordedAt,
    gps_lat: data.gps_lat,
    gps_lng: data.gps_lng,
    gps_accuracy_m: data.gps_accuracy_m,
    distance_from_job_address_m: geo.distanceM,
    flagged: geo.flagged,
  });

  // 23505 = the (worker_id, client_event_id) dedup index already has this event:
  // a replayed clock-in from the offline queue. Idempotent — treat as success.
  if (error && error.code !== '23505') {
    return { status: 'error', message: 'Could not record the clock-in.' };
  }

  revalidatePath(`/jobs/${data.job_id}`);
  redirect(`/jobs/${data.job_id}?clocked_in=1`);
}

export { IDLE as INITIAL_CLOCK_IN_STATE };
