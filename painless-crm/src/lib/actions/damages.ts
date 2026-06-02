'use server';

import { requireRole } from '@/lib/auth/require-role';
import { shouldAutoEscalate } from '@/lib/damages/escalation';
import { notifyDamageEscalation } from '@/lib/damages/notify';
import { type DamageStatus, canTransition, isTerminal } from '@/lib/damages/state-machine';
import { DamageCreateSchema, DamageUpdateSchema } from '@/lib/schemas/damage';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

const ADMIN_ROLES = ['admin', 'super_admin'] as const;

export type DamageActionState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'ok' };

export const INITIAL_DAMAGE_STATE: DamageActionState = { status: 'idle' };

const pence = (pounds: number | undefined) =>
  pounds === undefined ? null : Math.round(pounds * 100);

// Flags repeat-claim patterns: when a customer has damage claims on 2+ separate
// jobs, every one of their claims is flagged (surfaced in the customer 360 —
// Phase 16). Returns whether the customer is now a repeat claimant.
async function applyRepeatClaimFlag(
  supabase: Awaited<ReturnType<typeof createClient>>,
  customerId: string,
): Promise<void> {
  const { data: jobRows } = await supabase
    .from('jobs')
    .select('id')
    .eq('customer_id', customerId)
    .is('deleted_at', null);
  const jobIds = ((jobRows ?? []) as Array<{ id: string }>).map((j) => j.id);
  if (jobIds.length === 0) return;

  const { data: claimRows } = await supabase
    .from('damage_claims')
    .select('id, job_id')
    .in('job_id', jobIds)
    .is('deleted_at', null);
  const claims = (claimRows ?? []) as Array<{ id: string; job_id: string }>;
  const distinctJobs = new Set(claims.map((c) => c.job_id));
  if (distinctJobs.size < 2) return;

  await supabase
    .from('damage_claims')
    .update({ repeat_claim_flag: true })
    .in(
      'id',
      claims.map((c) => c.id),
    );
}

export async function createDamage(
  _prev: DamageActionState,
  form: FormData,
): Promise<DamageActionState> {
  const me = await requireRole(ADMIN_ROLES);

  const parsed = DamageCreateSchema.safeParse({
    job_id: form.get('job_id'),
    description: form.get('description'),
    estimated_value_pounds: form.get('estimated_value_pounds') || undefined,
    reported_by_customer: form.get('reported_by_customer') || undefined,
  });
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const supabase = await createClient();
  const { data: job } = await supabase
    .from('jobs')
    .select('customer_id')
    .eq('id', parsed.data.job_id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!job) return { status: 'error', message: 'Job not found' };

  const { error } = await supabase.from('damage_claims').insert({
    company_id: me.company_id,
    job_id: parsed.data.job_id,
    description: parsed.data.description,
    estimated_value_pence: pence(parsed.data.estimated_value_pounds),
    reported_by_customer: parsed.data.reported_by_customer,
    status: 'reported',
  });
  if (error) return { status: 'error', message: 'Could not create the damage claim' };

  await applyRepeatClaimFlag(supabase, (job as { customer_id: string }).customer_id);

  revalidatePath(`/dashboard/jobs/${parsed.data.job_id}/damages`);
  revalidatePath('/dashboard/damages');
  return { status: 'ok' };
}

export async function updateDamage(
  _prev: DamageActionState,
  form: FormData,
): Promise<DamageActionState> {
  const me = await requireRole(ADMIN_ROLES);

  const parsed = DamageUpdateSchema.safeParse({
    id: form.get('id'),
    version: form.get('version'),
    status: form.get('status'),
    estimated_value_pounds: form.get('estimated_value_pounds') || undefined,
    payout_pounds: form.get('payout_pounds') || undefined,
    insurance_claim_ref: form.get('insurance_claim_ref') || undefined,
  });
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from('damage_claims')
    .select('status, version, job_id, auto_escalated')
    .eq('id', parsed.data.id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!existing) return { status: 'error', message: 'Claim not found' };

  const row = existing as {
    status: DamageStatus;
    version: number;
    job_id: string;
    auto_escalated: boolean | null;
  };
  if (row.version !== parsed.data.version) {
    return { status: 'error', message: 'This claim changed elsewhere. Reload and retry.' };
  }
  const next = parsed.data.status;
  if (next !== row.status && !canTransition(row.status, next)) {
    return { status: 'error', message: `Cannot move a claim from ${row.status} to ${next}` };
  }

  const payoutPence = pence(parsed.data.payout_pounds);
  // Large payouts auto-escalate to admins (Phase 16 §4), once per claim.
  const escalate = shouldAutoEscalate(payoutPence, row.auto_escalated ?? false);

  const update: Record<string, unknown> = {
    status: next,
    estimated_value_pence: pence(parsed.data.estimated_value_pounds),
    payout_pence: payoutPence,
    insurance_claim_ref: parsed.data.insurance_claim_ref ?? null,
    version: parsed.data.version + 1,
  };
  if (isTerminal(next)) update.resolved_at = new Date().toISOString();
  if (escalate) update.auto_escalated = true;

  const { data: saved, error } = await supabase
    .from('damage_claims')
    .update(update)
    .eq('id', parsed.data.id)
    .eq('version', parsed.data.version)
    .select('id')
    .maybeSingle();
  if (error || !saved) {
    return { status: 'error', message: 'Could not update the claim. Reload and retry.' };
  }

  if (escalate && payoutPence != null) {
    const { data: jobRow } = await supabase
      .from('jobs')
      .select('job_number')
      .eq('id', row.job_id)
      .maybeSingle();
    await notifyDamageEscalation({
      companyId: me.company_id,
      jobId: row.job_id,
      jobNumber: (jobRow as { job_number: string | number | null } | null)?.job_number ?? null,
      payoutPence,
    });
  }

  revalidatePath(`/dashboard/jobs/${row.job_id}/damages`);
  revalidatePath('/dashboard/damages');
  return { status: 'ok' };
}
