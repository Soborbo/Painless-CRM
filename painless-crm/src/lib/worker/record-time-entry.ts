import { getWorkerJobDetail } from '@/lib/queries/worker-app';
import type { TimeEntryInput } from '@/lib/schemas/time-entry';
import { createClient } from '@/lib/supabase/server';
import { boundedClientTimestamp } from './client-timestamp';

// Shared persister for job-progress time entries (load/unload start/end,
// clock-out). Idempotent via the client_event_id dedup index (23505 = a replayed
// queued entry → success). No GPS — only clock-in is location-verified.

export type PersistTimeEntryResult = 'ok' | 'not_assigned' | 'error';

export async function persistTimeEntry(
  worker: { id: string; company_id: string },
  input: TimeEntryInput,
): Promise<PersistTimeEntryResult> {
  const today = new Date().toISOString().slice(0, 10);
  const detail = await getWorkerJobDetail(input.job_id, worker.id, today);
  if (!detail) return 'not_assigned';

  const recordedAt = boundedClientTimestamp(input.client_recorded_at);
  const supabase = await createClient();
  const { error } = await supabase.from('time_entries').insert({
    company_id: worker.company_id,
    job_id: input.job_id,
    worker_id: worker.id,
    type: input.type,
    occurred_at: recordedAt,
    client_event_id: input.client_event_id,
    client_recorded_at: recordedAt,
  });

  if (error && error.code !== '23505') return 'error';
  return 'ok';
}
