'use server';

import { requireRole } from '@/lib/auth/require-role';
import { getWorkerForUser } from '@/lib/queries/worker-app';
import { ClockInSchema } from '@/lib/schemas/clock-in';
import { persistClockIn } from '@/lib/worker/record-clock-in';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

// Worker roles plus office roles (so managers can test/demo the PWA).
const WORKER_APP_ROLES = ['loader', 'surveyor', 'manager', 'admin', 'super_admin'] as const;

export type ClockInState = { status: 'idle' } | { status: 'error'; message: string };

const IDLE: ClockInState = { status: 'idle' };

// Online fallback path (non-queue submit). The PWA normally enqueues clock-ins
// and replays them via /api/worker/clock-in; both share persistClockIn().
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

  const result = await persistClockIn(worker, parsed.data);
  if (result === 'not_assigned') {
    return { status: 'error', message: 'You are not assigned to this job.' };
  }
  if (result === 'error') {
    return { status: 'error', message: 'Could not record the clock-in.' };
  }

  revalidatePath(`/jobs/${parsed.data.job_id}`);
  redirect(`/jobs/${parsed.data.job_id}?clocked_in=1`);
}

export { IDLE as INITIAL_CLOCK_IN_STATE };
