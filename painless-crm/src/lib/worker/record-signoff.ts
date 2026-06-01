import { getWorkerJobDetail } from '@/lib/queries/worker-app';
import type { SignoffInput } from '@/lib/schemas/signoff';
import { createClient } from '@/lib/supabase/server';

// Shared persister for the end-of-job customer sign-off (Phase 11 §1).
// Idempotent via the client_event_id dedup index (23505 = a replayed queued
// submit). On the first successful capture it also transitions the job
// in_progress -> completed (STATE_MACHINE.md: `customer_signoff_id` is the
// completed-stage entry condition) and records the history row. The transition
// is guarded on stage = 'in_progress', so a replay is a no-op.

export type PersistSignoffResult = 'ok' | 'not_assigned' | 'error';

interface Actor {
  id: string; // worker id
  company_id: string;
  user_id: string | null; // authed app user (job_status_history.changed_by_id)
}

export async function persistSignoff(
  actor: Actor,
  input: SignoffInput,
): Promise<PersistSignoffResult> {
  const today = new Date().toISOString().slice(0, 10);
  const detail = await getWorkerJobDetail(input.job_id, actor.id, today);
  if (!detail) return 'not_assigned';

  const supabase = await createClient();
  const { data: job } = await supabase
    .from('jobs')
    .select('id, stage, version, customer_id')
    .eq('id', input.job_id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!job) return 'not_assigned';

  const recordedAt = input.client_recorded_at ?? new Date().toISOString();
  const now = new Date().toISOString();

  // 1) Capture the sign-off (idempotent on replay).
  const { data: inserted, error: insertError } = await supabase
    .from('customer_signoffs')
    .insert({
      company_id: actor.company_id,
      job_id: input.job_id,
      customer_id: (job as { customer_id: string }).customer_id,
      collected_by_worker_id: actor.id,
      signature_data_url: input.signature_data_url,
      internal_rating_1_5: input.internal_rating_1_5,
      feedback_text: input.feedback_text ?? null,
      customer_email_confirmed_at: input.email_confirmed ? now : null,
      device_lat: input.device_lat,
      device_lng: input.device_lng,
      client_event_id: input.client_event_id,
      client_recorded_at: recordedAt,
    })
    .select('id')
    .single();

  let signoffId: string | undefined = inserted?.id;
  if (insertError) {
    if (insertError.code !== '23505') return 'error';
    // Replay: find the row this client_event_id already created.
    const { data: existing } = await supabase
      .from('customer_signoffs')
      .select('id')
      .eq('collected_by_worker_id', actor.id)
      .eq('client_event_id', input.client_event_id)
      .maybeSingle();
    signoffId = existing?.id;
  }
  if (!signoffId) return 'error';

  // 2) Transition in_progress -> completed (guarded; replay is a no-op).
  const stage = (job as { stage: string }).stage;
  const version = (job as { version: number }).version;
  if (stage === 'in_progress') {
    const { data: moved } = await supabase
      .from('jobs')
      .update({
        stage: 'completed',
        completed_at: now,
        customer_signoff_id: signoffId,
        profit_review_status: 'pending',
        updated_by_id: actor.user_id,
        version: version + 1,
      })
      .eq('id', input.job_id)
      .eq('version', version)
      .eq('stage', 'in_progress')
      .select('id')
      .maybeSingle();

    if (moved) {
      await supabase.from('job_status_history').insert({
        company_id: actor.company_id,
        job_id: input.job_id,
        from_stage: 'in_progress',
        to_stage: 'completed',
        changed_by_id: actor.user_id,
        reason: 'Customer signed end-of-job form',
      });
    }
  }

  return 'ok';
}
