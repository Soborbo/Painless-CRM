import { boundedClientTimestamp } from './client-timestamp';
import { enqueueStageAutomation } from '@/lib/comms/automation-enqueue';
import { finalBalancePence } from '@/lib/invoices/auto-create';
import { createInvoiceWithLine, jobHasInvoiceOfType } from '@/lib/invoices/create';
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
    .select('id, stage, version, customer_id, quote_total_pence')
    .eq('id', input.job_id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!job) return 'not_assigned';

  const recordedAt = boundedClientTimestamp(input.client_recorded_at);
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
    // The 23505 may instead be the one-sign-off-per-job constraint (a second
    // sign-off for an already-signed job — e.g. a two-person crew each
    // submitting with a fresh client_event_id). Fall back to the existing live
    // sign-off for the job so the offline queue clears it instead of retrying to
    // a permanent dead-letter (audit M1). The stage transition below is guarded,
    // so re-signing a completed job is a no-op.
    if (!signoffId) {
      const { data: jobSignoff } = await supabase
        .from('customer_signoffs')
        .select('id')
        .eq('job_id', input.job_id)
        .is('deleted_at', null)
        .maybeSingle();
      signoffId = jobSignoff?.id;
    }
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

      // Auto-create the draft final invoice (Phase 12 §3) — best-effort; a
      // failure must never undo the sign-off the customer just gave.
      try {
        await maybeCreateFinalInvoice(supabase, {
          companyId: actor.company_id,
          jobId: input.job_id,
          customerId: (job as { customer_id: string }).customer_id,
          quoteTotalPence: (job as { quote_total_pence: number | null }).quote_total_pence ?? 0,
          userId: actor.user_id,
        });
      } catch {
        // swallow — final invoice is best-effort
      }

      // Fire any matching automation rules for in_progress → completed (Phase 13 §5).
      try {
        await enqueueStageAutomation({
          companyId: actor.company_id,
          jobId: input.job_id,
          fromStage: 'in_progress',
          toStage: 'completed',
        });
      } catch {
        // best-effort
      }
    }
  }

  return 'ok';
}

// Final invoice = quote total minus what's already been invoiced (deposit /
// custom), once per job, only when there's a positive balance to bill.
async function maybeCreateFinalInvoice(
  supabase: Awaited<ReturnType<typeof createClient>>,
  args: {
    companyId: string;
    jobId: string;
    customerId: string;
    quoteTotalPence: number;
    userId: string | null;
  },
): Promise<void> {
  if (args.quoteTotalPence <= 0) return;
  if (await jobHasInvoiceOfType(supabase, args.jobId, 'final')) return;

  const { data: existing } = await supabase
    .from('invoices')
    .select('total_pence')
    .eq('job_id', args.jobId)
    .neq('status', 'void')
    .neq('type', 'credit_note') // a credit note is money OUT, not prior billing (audit)
    .is('deleted_at', null);
  const invoiced = ((existing ?? []) as Array<{ total_pence: number }>).reduce(
    (sum, r) => sum + (r.total_pence ?? 0),
    0,
  );
  const balance = finalBalancePence(args.quoteTotalPence, invoiced);
  if (balance <= 0) return;

  await createInvoiceWithLine(supabase, {
    company_id: args.companyId,
    customer_id: args.customerId,
    job_id: args.jobId,
    type: 'final',
    description: 'Final balance',
    amount_pence: balance,
    vat_rate: 0, // quote totals are already gross
    created_by_id: args.userId,
  });
}
