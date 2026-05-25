'use server';

import { requireRole } from '@/lib/auth/require-role';
import {
  canEditProfitReview,
  canFinaliseProfitReview,
  isProfitReviewStage,
} from '@/lib/jobs/profit';
import { ProfitReviewSubmitSchema } from '@/lib/schemas/profit-review';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

// Phase 06b §2. One Server Action covers the three intents:
//   - save           → write costs, leave status untouched
//   - mark_reviewed  → write costs, advance status pending → reviewed
//   - finalize       → admin-only lock: reviewed → finalized
// Optimistic concurrency via the `version` column keeps two reps
// from clobbering each other on the same job.

const REVIEW_ROLES = ['manager', 'admin', 'super_admin'] as const;

export type ProfitReviewState =
  | { status: 'idle' }
  | {
      status: 'error';
      reason:
        | 'invalid_input'
        | 'not_found'
        | 'wrong_stage'
        | 'locked'
        | 'forbidden'
        | 'version_conflict'
        | 'unknown';
    }
  | { status: 'ok'; intent: 'save' | 'mark_reviewed' | 'finalize' };

export const INITIAL_PROFIT_REVIEW_STATE: ProfitReviewState = { status: 'idle' };

export async function submitProfitReview(
  _prev: ProfitReviewState,
  form: FormData,
): Promise<ProfitReviewState> {
  const me = await requireRole(REVIEW_ROLES);

  const parsed = ProfitReviewSubmitSchema.safeParse({
    job_id: form.get('job_id'),
    version: form.get('version'),
    intent: form.get('intent'),
    actual_crew_cost_pence: form.get('actual_crew_cost_pence') ?? '',
    actual_van_cost_pence: form.get('actual_van_cost_pence') ?? '',
    passthrough_costs_pence: form.get('passthrough_costs_pence') ?? '',
  });
  if (!parsed.success) return { status: 'error', reason: 'invalid_input' };

  const supabase = await createClient();
  const { data: job } = await supabase
    .from('jobs')
    .select('id, stage, profit_review_status, version')
    .eq('id', parsed.data.job_id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!job) return { status: 'error', reason: 'not_found' };
  if (!isProfitReviewStage(job.stage as string)) {
    return { status: 'error', reason: 'wrong_stage' };
  }
  const currentStatus = job.profit_review_status as 'pending' | 'reviewed' | 'finalized';
  if (!canEditProfitReview(currentStatus)) {
    return { status: 'error', reason: 'locked' };
  }

  const update: Record<string, unknown> = {
    actual_crew_cost_pence: parsed.data.actual_crew_cost_pence,
    actual_van_cost_pence: parsed.data.actual_van_cost_pence,
    passthrough_costs_pence: parsed.data.passthrough_costs_pence,
    updated_by_id: me.id,
  };

  if (parsed.data.intent === 'mark_reviewed') {
    update.profit_review_status = 'reviewed';
    update.profit_review_completed_by_id = me.id;
    update.profit_review_completed_at = new Date().toISOString();
  } else if (parsed.data.intent === 'finalize') {
    if (!canFinaliseProfitReview(currentStatus, me.role)) {
      return { status: 'error', reason: 'forbidden' };
    }
    update.profit_review_status = 'finalized';
  }

  const { data: written } = await supabase
    .from('jobs')
    .update(update)
    .eq('id', parsed.data.job_id)
    .eq('version', parsed.data.version)
    .select('id')
    .maybeSingle();
  if (!written) return { status: 'error', reason: 'version_conflict' };

  revalidatePath(`/dashboard/jobs/${parsed.data.job_id}`);
  revalidatePath(`/dashboard/jobs/${parsed.data.job_id}/profit-review`);
  revalidatePath('/dashboard');
  return { status: 'ok', intent: parsed.data.intent };
}
