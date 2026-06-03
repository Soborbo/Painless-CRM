import { boundedClientTimestamp } from './client-timestamp';
import { validateValues } from '@/lib/custom-fields/defs';
import { getJobSheetFieldDefsForCompany } from '@/lib/queries/custom-fields';
import { getWorkerJobDetail } from '@/lib/queries/worker-app';
import type { JobSheetInput } from '@/lib/schemas/job-sheet';
import { createClient } from '@/lib/supabase/server';

// Shared persister for the end-of-job sheet. Idempotent via the client_event_id
// dedup index (23505 = a replayed queued submit → success).

export type PersistJobSheetResult = 'ok' | 'not_assigned' | 'error';

export async function persistJobSheet(
  worker: { id: string; company_id: string },
  input: JobSheetInput,
): Promise<PersistJobSheetResult> {
  const today = new Date().toISOString().slice(0, 10);
  const detail = await getWorkerJobDetail(input.job_id, worker.id, today);
  if (!detail) return 'not_assigned';

  const recordedAt = boundedClientTimestamp(input.client_recorded_at);

  // Phase 25 — coerce any tenant-configured job-sheet fields against the defs.
  // Resilient: keeps valid values, drops unknown/invalid (required-enforcement
  // lives in the form), so an offline replay never hard-fails on this.
  const defs = await getJobSheetFieldDefsForCompany(worker.company_id);
  const { values: customFields } = validateValues(defs, input.custom_fields ?? {});

  const supabase = await createClient();
  const { error } = await supabase.from('job_sheets').insert({
    company_id: worker.company_id,
    job_id: input.job_id,
    worker_id: worker.id,
    actual_hours: input.actual_hours,
    actual_cubic_ft: input.actual_cubic_ft,
    complications_encountered: input.complications_encountered ?? null,
    damage_reported: input.damage_reported,
    damage_details: input.damage_details ?? null,
    customer_satisfaction_score: input.customer_satisfaction_score,
    custom_fields: customFields,
    client_event_id: input.client_event_id,
    client_recorded_at: recordedAt,
  });

  if (error && error.code !== '23505') return 'error';
  return 'ok';
}
