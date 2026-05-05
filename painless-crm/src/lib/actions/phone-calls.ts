'use server';

import { requireRole } from '@/lib/auth/require-role';
import { shouldRecordFirstResponse } from '@/lib/jobs/sla-touch';
import type { JobStage } from '@/lib/jobs/state-machine';
import { LogPhoneCallSchema } from '@/lib/schemas/phone-call';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

const SALES_ROLES = ['sales', 'manager', 'admin', 'super_admin'] as const;

export type LogPhoneCallState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'ok'; phone_call_id: string };

export const INITIAL_LOG_PHONE_CALL_STATE: LogPhoneCallState = { status: 'idle' };

export async function logPhoneCall(
  _prev: LogPhoneCallState,
  form: FormData,
): Promise<LogPhoneCallState> {
  const me = await requireRole(SALES_ROLES);

  const parsed = LogPhoneCallSchema.safeParse({
    job_id: form.get('job_id'),
    direction: form.get('direction'),
    occurred_at: form.get('occurred_at'),
    duration_seconds: form.get('duration_seconds'),
    caller_number: form.get('caller_number'),
    called_number: form.get('called_number'),
    notes: form.get('notes'),
  });
  if (!parsed.success) {
    return {
      status: 'error',
      message: parsed.error.issues[0]?.message ?? 'Invalid input',
    };
  }

  const supabase = await createClient();
  const { data: job } = await supabase
    .from('jobs')
    .select('id, customer_id, stage, first_response_at')
    .eq('id', parsed.data.job_id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!job) return { status: 'error', message: 'Job not found' };

  const { data: inserted, error } = await supabase
    .from('phone_calls')
    .insert({
      company_id: me.company_id,
      job_id: job.id,
      customer_id: job.customer_id,
      direction: parsed.data.direction,
      occurred_at: parsed.data.occurred_at,
      duration_seconds: parsed.data.duration_seconds,
      caller_number: parsed.data.caller_number,
      called_number: parsed.data.called_number,
      notes: parsed.data.notes,
      source: 'manual',
      user_id: me.id,
    })
    .select('id')
    .single();
  if (error || !inserted) {
    return { status: 'error', message: 'Could not log call' };
  }

  if (
    shouldRecordFirstResponse({
      stage: job.stage as JobStage,
      firstResponseAt: (job.first_response_at as string | null) ?? null,
      occurredAt: parsed.data.occurred_at,
    })
  ) {
    await supabase
      .from('jobs')
      .update({ first_response_at: parsed.data.occurred_at })
      .eq('id', job.id)
      .is('first_response_at', null);
  }

  revalidatePath(`/dashboard/jobs/${job.id}`);
  return { status: 'ok', phone_call_id: inserted.id as string };
}
