'use server';

import { recordCommissionForPaidJob } from '@/lib/affiliates/record';
import { requireRole, requireUser } from '@/lib/auth/require-role';
import { enqueueEventAutomation, enqueueStageAutomation } from '@/lib/comms/automation-enqueue';
import { pickNextRep } from '@/lib/jobs/routing';
import { computeFirstResponseDueAt } from '@/lib/jobs/sla-deadline';
import { type JobStage, classifyTransition } from '@/lib/jobs/state-machine';
import { createNotification } from '@/lib/notifications/create';
import {
  getLastAssignedRepId,
  getNextJobNumber,
  getRepLoads,
  listSalesReps,
} from '@/lib/queries/jobs';
import { enqueueReviewRequest } from '@/lib/reviews/enqueue';
import {
  AssignJobSchema,
  CreateJobSchema,
  JobTagSchema,
  TransitionJobSchema,
  UpdateJobSchema,
} from '@/lib/schemas/job';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

const SALES_ROLES = ['sales', 'manager', 'admin', 'super_admin'] as const;
const MANAGER_ROLES = ['manager', 'admin', 'super_admin'] as const;
const ADMIN_ROLES = ['admin', 'super_admin'] as const;

export type JobActionState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'ok'; id: string };

const IDLE: JobActionState = { status: 'idle' };

export async function createJob(_prev: JobActionState, form: FormData): Promise<JobActionState> {
  const me = await requireRole(SALES_ROLES);

  const parsed = CreateJobSchema.safeParse({
    customer_id: form.get('customer_id'),
    acquisition_source: form.get('acquisition_source'),
    assigned_to_id: form.get('assigned_to_id') || undefined,
    move_date: form.get('move_date'),
    notes: form.get('notes'),
  });
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  let assignedTo = parsed.data.assigned_to_id ?? null;
  if (!assignedTo) {
    const reps = await listSalesReps();
    const loads = await getRepLoads(reps.map((r) => r.id));
    const last = await getLastAssignedRepId();
    assignedTo = pickNextRep(reps, loads, last)?.id ?? null;
  }

  const supabase = await createClient();
  const jobNumber = await getNextJobNumber();
  const enquiryAt = new Date().toISOString();
  const firstResponseDueAt = computeFirstResponseDueAt(enquiryAt, parsed.data.acquisition_source);

  const { data, error } = await supabase
    .from('jobs')
    .insert({
      job_number: jobNumber,
      customer_id: parsed.data.customer_id,
      stage: 'lead',
      acquisition_source: parsed.data.acquisition_source,
      assigned_to_id: assignedTo,
      move_date: parsed.data.move_date,
      notes: parsed.data.notes,
      enquiry_at: enquiryAt,
      first_response_due_at: firstResponseDueAt,
      company_id: me.company_id,
      created_by_id: me.id,
      updated_by_id: me.id,
    })
    .select('id')
    .single();
  if (error || !data) return { status: 'error', message: 'Could not create job' };

  await supabase.from('job_status_history').insert({
    company_id: me.company_id,
    job_id: data.id,
    from_stage: null,
    to_stage: 'lead',
    changed_by_id: me.id,
    reason: 'Job created',
  });

  // Fire job.created automation (Phase 13b / ADR-024) — e.g. the Welcome email.
  // Best-effort; must never block job creation.
  try {
    await enqueueEventAutomation({
      companyId: me.company_id,
      event: 'job.created',
      jobId: data.id,
    });
  } catch {
    // swallow — automation is never on the critical path
  }

  revalidatePath('/dashboard/jobs');
  redirect(`/dashboard/jobs/${data.id}`);
}

export async function updateJob(_prev: JobActionState, form: FormData): Promise<JobActionState> {
  const me = await requireRole(SALES_ROLES);

  const parsed = UpdateJobSchema.safeParse({
    id: form.get('id'),
    version: form.get('version'),
    acquisition_source: form.get('acquisition_source'),
    assigned_to_id: form.get('assigned_to_id') || undefined,
    surveyor_id: form.get('surveyor_id') || undefined,
    move_date: form.get('move_date'),
    notes: form.get('notes'),
  });
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('jobs')
    .update({
      acquisition_source: parsed.data.acquisition_source,
      assigned_to_id: parsed.data.assigned_to_id,
      surveyor_id: parsed.data.surveyor_id,
      move_date: parsed.data.move_date,
      notes: parsed.data.notes,
      updated_by_id: me.id,
      version: parsed.data.version + 1,
    })
    .eq('id', parsed.data.id)
    .eq('version', parsed.data.version)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle();
  if (error) return { status: 'error', message: 'Could not update job' };
  if (!data) {
    return {
      status: 'error',
      message: 'This job was edited elsewhere. Reload to see the latest.',
    };
  }
  revalidatePath(`/dashboard/jobs/${parsed.data.id}`);
  revalidatePath('/dashboard/jobs');
  redirect(`/dashboard/jobs/${parsed.data.id}`);
}

const STAGE_TIMESTAMP_COLUMN: Partial<Record<JobStage, string>> = {
  contacted: 'contacted_at',
  survey_scheduled: 'survey_at',
  quoted: 'quoted_at',
  accepted: 'accepted_at',
  confirmed: 'confirmed_at',
  in_progress: 'in_progress_at',
  completed: 'completed_at',
  invoiced: 'invoiced_at',
  paid: 'paid_at',
  declined: 'declined_at',
  dead: 'dead_at',
  cancelled: 'cancelled_at',
};

export async function transitionJobStage(
  _prev: JobActionState,
  form: FormData,
): Promise<JobActionState> {
  const me = await requireUser();

  const parsed = TransitionJobSchema.safeParse({
    id: form.get('id'),
    version: form.get('version'),
    target_stage: form.get('target_stage'),
    reason: form.get('reason'),
    decline_reason: form.get('decline_reason') || undefined,
    cancellation_reason: form.get('cancellation_reason'),
    deposit_refund_decision: form.get('deposit_refund_decision') || undefined,
  });
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from('jobs')
    .select('stage, version, service_type')
    .eq('id', parsed.data.id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!existing) return { status: 'error', message: 'Job not found' };
  if (existing.version !== parsed.data.version) {
    return {
      status: 'error',
      message: 'This job was edited elsewhere. Reload to see the latest.',
    };
  }

  const fromStage = existing.stage as JobStage;
  const direction = classifyTransition(fromStage, parsed.data.target_stage);
  if (direction === 'forbidden') {
    return {
      status: 'error',
      message: `Cannot transition from ${fromStage} to ${parsed.data.target_stage}`,
    };
  }
  if (direction === 'backward' && !(MANAGER_ROLES as readonly string[]).includes(me.role)) {
    return { status: 'error', message: 'Only managers can revert stages' };
  }
  if (direction === 'backward' && !parsed.data.reason) {
    return { status: 'error', message: 'Revert reason is required' };
  }

  const tsColumn = STAGE_TIMESTAMP_COLUMN[parsed.data.target_stage];
  const now = new Date().toISOString();
  const update: Record<string, unknown> = {
    stage: parsed.data.target_stage,
    updated_by_id: me.id,
    version: parsed.data.version + 1,
  };
  if (tsColumn && direction === 'forward') update[tsColumn] = now;
  if (parsed.data.target_stage === 'declined' && parsed.data.decline_reason) {
    update.decline_reason = parsed.data.decline_reason;
  }
  if (parsed.data.target_stage === 'cancelled') {
    update.cancellation_reason = parsed.data.cancellation_reason;
    update.deposit_refund_decision = parsed.data.deposit_refund_decision;
  }

  const { error: updateError } = await supabase
    .from('jobs')
    .update(update)
    .eq('id', parsed.data.id)
    .eq('version', parsed.data.version);
  if (updateError) {
    return { status: 'error', message: 'Could not update job stage' };
  }

  await supabase.from('job_status_history').insert({
    company_id: me.company_id,
    job_id: parsed.data.id,
    from_stage: fromStage,
    to_stage: parsed.data.target_stage,
    changed_by_id: me.id,
    reason: parsed.data.reason,
  });

  // ENTER `paid` → queue the universal review request (Phase 11 §3, ADR-010)
  // and record any affiliate commission (Phase 16 §1, idempotent).
  if (parsed.data.target_stage === 'paid' && direction === 'forward') {
    await enqueueReviewRequest(supabase, me.company_id, parsed.data.id);
    try {
      await recordCommissionForPaidJob(supabase, me.company_id, parsed.data.id);
    } catch {
      // best-effort — commission must never block the transition
    }
  }

  // Fire any matching automation rules for this stage change (Phase 13 §5).
  try {
    await enqueueStageAutomation({
      companyId: me.company_id,
      jobId: parsed.data.id,
      fromStage,
      toStage: parsed.data.target_stage,
      serviceType: (existing as { service_type?: string | null }).service_type ?? null,
    });
  } catch {
    // best-effort — automation must never block the transition
  }

  revalidatePath(`/dashboard/jobs/${parsed.data.id}`);
  revalidatePath('/dashboard/jobs');
  return { status: 'ok', id: parsed.data.id };
}

export async function assignJob(_prev: JobActionState, form: FormData): Promise<JobActionState> {
  const me = await requireRole(MANAGER_ROLES);

  const parsed = AssignJobSchema.safeParse({
    id: form.get('id'),
    version: form.get('version'),
    assigned_to_id: form.get('assigned_to_id'),
  });
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('jobs')
    .update({
      assigned_to_id: parsed.data.assigned_to_id,
      updated_by_id: me.id,
      version: parsed.data.version + 1,
    })
    .eq('id', parsed.data.id)
    .eq('version', parsed.data.version)
    .is('deleted_at', null)
    .select('id, job_number')
    .maybeSingle();
  if (error || !data) {
    return {
      status: 'error',
      message: 'Could not assign job. Reload and try again.',
    };
  }

  // Notify the assignee — unless they assigned the job to themselves.
  const assignee = parsed.data.assigned_to_id;
  if (assignee && assignee !== me.id) {
    await createNotification({
      companyId: me.company_id,
      recipientUserId: assignee,
      type: 'assignment',
      title: `You were assigned job ${data.job_number}`,
      linkUrl: `/dashboard/jobs/${data.id}`,
      relatedEntityType: 'job',
      relatedEntityId: data.id,
    });
  }

  revalidatePath(`/dashboard/jobs/${parsed.data.id}`);
  return { status: 'ok', id: parsed.data.id };
}

export async function addJobTag(_prev: JobActionState, form: FormData): Promise<JobActionState> {
  const me = await requireRole(SALES_ROLES);

  const parsed = JobTagSchema.safeParse({
    job_id: form.get('job_id'),
    tag: form.get('tag'),
  });
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Invalid tag' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('job_tags').upsert(
    {
      company_id: me.company_id,
      job_id: parsed.data.job_id,
      tag: parsed.data.tag,
      added_by_id: me.id,
    },
    { onConflict: 'job_id,tag' },
  );
  if (error) return { status: 'error', message: 'Could not add tag' };

  revalidatePath(`/dashboard/jobs/${parsed.data.job_id}`);
  return { status: 'ok', id: parsed.data.job_id };
}

export async function removeJobTag(_prev: JobActionState, form: FormData): Promise<JobActionState> {
  await requireRole(SALES_ROLES);

  const parsed = JobTagSchema.safeParse({
    job_id: form.get('job_id'),
    tag: form.get('tag'),
  });
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Invalid tag' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('job_tags')
    .delete()
    .eq('job_id', parsed.data.job_id)
    .eq('tag', parsed.data.tag);
  if (error) return { status: 'error', message: 'Could not remove tag' };

  revalidatePath(`/dashboard/jobs/${parsed.data.job_id}`);
  return { status: 'ok', id: parsed.data.job_id };
}

export async function softDeleteJob(
  _prev: JobActionState,
  form: FormData,
): Promise<JobActionState> {
  await requireRole(ADMIN_ROLES);

  const id = form.get('id');
  const versionRaw = form.get('version');
  if (typeof id !== 'string' || typeof versionRaw !== 'string') {
    return { status: 'error', message: 'Missing id or version' };
  }
  const version = Number.parseInt(versionRaw, 10);
  if (!Number.isFinite(version)) return { status: 'error', message: 'Invalid version' };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('jobs')
    .update({ deleted_at: new Date().toISOString(), version: version + 1 })
    .eq('id', id)
    .eq('version', version)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle();
  if (error || !data) return { status: 'error', message: 'Could not delete job' };

  revalidatePath('/dashboard/jobs');
  redirect('/dashboard/jobs');
}

export { IDLE as INITIAL_JOB_STATE };
