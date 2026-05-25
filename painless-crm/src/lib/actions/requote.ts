'use server';

import { requireRole } from '@/lib/auth/require-role';
import { buildRequoteInsert, isRequoteEligibleStage } from '@/lib/jobs/requote';
import { pickNextRep } from '@/lib/jobs/routing';
import {
  getLastAssignedRepId,
  getNextJobNumber,
  getRepLoads,
  listSalesReps,
} from '@/lib/queries/jobs';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

// Phase 06b §6 — one-click requote. A returning customer (or recovered
// dead lead) becomes a fresh `lead` job linked to the original via
// parent_job_id. We carry the estimating quantities so the new quote
// opens half-prefilled and round-robin a rep to it just like a new
// inbound lead.

const REQUOTE_ROLES = ['sales', 'manager', 'admin', 'super_admin'] as const;

const FormSchema = z.object({
  source_job_id: z.string().uuid(),
  move_date: z
    .string()
    .trim()
    .max(40)
    .transform((v) => (v.length === 0 ? null : v))
    .refine((v) => v === null || !Number.isNaN(Date.parse(v)), { message: 'Invalid date' })
    .transform((v) => (v ? new Date(v).toISOString() : null)),
  notes: z
    .string()
    .max(4000)
    .optional()
    .transform((v) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null)),
});

export type RequoteJobState =
  | { status: 'idle' }
  | {
      status: 'error';
      reason: 'invalid_input' | 'not_found' | 'wrong_stage' | 'no_capacity' | 'unknown';
    }
  | { status: 'ok'; new_job_id: string };

export const INITIAL_REQUOTE_STATE: RequoteJobState = { status: 'idle' };

export async function requoteJob(_prev: RequoteJobState, form: FormData): Promise<RequoteJobState> {
  const me = await requireRole(REQUOTE_ROLES);

  const parsed = FormSchema.safeParse({
    source_job_id: form.get('source_job_id'),
    move_date: form.get('move_date') ?? '',
    notes: form.get('notes') ?? undefined,
  });
  if (!parsed.success) return { status: 'error', reason: 'invalid_input' };

  const supabase = await createClient();
  const { data: source } = await supabase
    .from('jobs')
    .select(
      'id, company_id, customer_id, stage, acquisition_source, estimated_hours, estimated_cubic_ft, estimated_distance_miles',
    )
    .eq('id', parsed.data.source_job_id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!source) return { status: 'error', reason: 'not_found' };
  if (!isRequoteEligibleStage(source.stage as string)) {
    return { status: 'error', reason: 'wrong_stage' };
  }

  const reps = await listSalesReps();
  const loads = await getRepLoads(reps.map((r) => r.id));
  const last = await getLastAssignedRepId();
  const assignedTo = pickNextRep(reps, loads, last)?.id ?? null;
  const jobNumber = await getNextJobNumber();

  const insert = buildRequoteInsert({
    source: {
      id: source.id as string,
      company_id: source.company_id as string,
      customer_id: source.customer_id as string,
      stage: source.stage as string,
      acquisition_source: source.acquisition_source as string | null,
      estimated_hours: source.estimated_hours as number | null,
      estimated_cubic_ft: source.estimated_cubic_ft as number | null,
      estimated_distance_miles: source.estimated_distance_miles as number | null,
    },
    jobNumber,
    overrides: {
      moveDateIso: parsed.data.move_date,
      assignedToId: assignedTo,
      notes: parsed.data.notes,
    },
    actorId: me.id,
  });

  const { data, error } = await supabase.from('jobs').insert(insert).select('id').single();
  if (error || !data) return { status: 'error', reason: 'unknown' };

  await supabase.from('job_status_history').insert({
    company_id: me.company_id,
    job_id: data.id,
    from_stage: null,
    to_stage: 'lead',
    changed_by_id: me.id,
    reason: `Requoted from ${source.id as string}`,
  });

  revalidatePath('/dashboard/jobs');
  revalidatePath(`/dashboard/jobs/${source.id as string}`);
  redirect(`/dashboard/jobs/${data.id as string}`);
}
