'use server';

import { requireRole } from '@/lib/auth/require-role';
import { enqueueEventAutomation } from '@/lib/comms/automation-enqueue';
import { pickNextRep } from '@/lib/jobs/routing';
import { computeFirstResponseDueAt } from '@/lib/jobs/sla-deadline';
import { emitEvent } from '@/lib/notifications/emit';
import {
  getLastAssignedRepId,
  getNextJobNumber,
  getRepLoads,
  listSalesReps,
} from '@/lib/queries/jobs';
import { CreateJobFromCallSchema, MarkCallReturnedSchema } from '@/lib/schemas/phone-call';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

const SALES_ROLES = ['sales', 'manager', 'admin', 'super_admin'] as const;

export type CallInboxState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'ok' };

export const INITIAL_CALL_INBOX_STATE: CallInboxState = { status: 'idle' };

// "I called this person back." Login-attributed: stamps returned_by/at from the
// authenticated user on the inbound call. The optional note is written to the
// linked job (notes.parent_type='job', category 'staff') so what happened on the
// call lands on the job sheet + timeline, visible to everyone (ADR-041).
export async function markCallReturned(
  _prev: CallInboxState,
  form: FormData,
): Promise<CallInboxState> {
  const me = await requireRole(SALES_ROLES);

  const parsed = MarkCallReturnedSchema.safeParse({
    phone_call_id: form.get('phone_call_id'),
    note: form.get('note'),
  });
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const supabase = await createClient();
  const { data: call } = await supabase
    .from('phone_calls')
    .select('id, job_id')
    .eq('id', parsed.data.phone_call_id)
    .eq('company_id', me.company_id)
    .maybeSingle();
  if (!call) return { status: 'error', message: 'Call not found' };

  const { error } = await supabase
    .from('phone_calls')
    .update({ returned_at: new Date().toISOString(), returned_by_id: me.id })
    .eq('id', parsed.data.phone_call_id)
    .eq('company_id', me.company_id);
  if (error) return { status: 'error', message: 'Could not update call' };

  if (parsed.data.note && call.job_id) {
    await supabase.from('notes').insert({
      company_id: me.company_id,
      parent_type: 'job',
      parent_id: call.job_id,
      body: parsed.data.note,
      category: 'staff',
      is_customer_visible: false,
      created_by_id: me.id,
    });
  }

  // NOTE: no revalidatePath — the dashboard is force-dynamic (+ the Calls page
  // auto-refreshes), and OpenNext on Cloudflare has no tag cache configured, so
  // revalidatePath throws in the post-action flush (500). See ADR-041 follow-up.
  return { status: 'ok' };
}

// Create a lead job from an unmatched inbound call: find-or-create the customer
// from the caller number, open a lead job (mirrors createJob), then link the
// call to it. Redirects to the new job's detail page.
export async function createJobFromCall(
  _prev: CallInboxState,
  form: FormData,
): Promise<CallInboxState> {
  const me = await requireRole(SALES_ROLES);

  const parsed = CreateJobFromCallSchema.safeParse({ phone_call_id: form.get('phone_call_id') });
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const supabase = await createClient();
  const { data: call } = await supabase
    .from('phone_calls')
    .select('id, job_id, customer_id, caller_number')
    .eq('id', parsed.data.phone_call_id)
    .eq('company_id', me.company_id)
    .maybeSingle();
  if (!call) return { status: 'error', message: 'Call not found' };
  if (call.job_id) redirect(`/dashboard/jobs/${call.job_id}`);

  // Customer: reuse a matched one, else create a stub from the caller number.
  let customerId = (call.customer_id as string | null) ?? null;
  if (!customerId) {
    const { data: cust, error: custErr } = await supabase
      .from('customers')
      .insert({
        company_id: me.company_id,
        customer_type: 'individual',
        primary_phone: call.caller_number,
        acquisition_source: 'phone',
        first_contact_at: new Date().toISOString(),
        created_by_id: me.id,
        updated_by_id: me.id,
      })
      .select('id')
      .single();
    if (custErr || !cust) return { status: 'error', message: 'Could not create customer' };
    customerId = cust.id as string;
  }

  // Round-robin assignment, same as createJob.
  const reps = await listSalesReps();
  const loads = await getRepLoads(reps.map((r) => r.id));
  const last = await getLastAssignedRepId();
  const assignedTo = pickNextRep(reps, loads, last)?.id ?? null;

  const enquiryAt = new Date().toISOString();
  const firstResponseDueAt = computeFirstResponseDueAt(enquiryAt, 'phone');

  let jobId: string | null = null;
  let jobNumber = '';
  for (let attempt = 0; attempt < 3 && !jobId; attempt += 1) {
    jobNumber = await getNextJobNumber();
    const res = await supabase
      .from('jobs')
      .insert({
        job_number: jobNumber,
        customer_id: customerId,
        stage: 'lead',
        acquisition_source: 'phone',
        assigned_to_id: assignedTo,
        enquiry_at: enquiryAt,
        first_response_due_at: firstResponseDueAt,
        company_id: me.company_id,
        created_by_id: me.id,
        updated_by_id: me.id,
      })
      .select('id')
      .single();
    if (!res.error && res.data) {
      jobId = res.data.id as string;
      break;
    }
    if (res.error && res.error.code !== '23505') {
      return { status: 'error', message: 'Could not create job' };
    }
  }
  if (!jobId) return { status: 'error', message: 'Could not create job' };

  await supabase.from('job_status_history').insert({
    company_id: me.company_id,
    job_id: jobId,
    from_stage: null,
    to_stage: 'lead',
    changed_by_id: me.id,
    reason: 'Job created from inbound call',
  });

  // Link the call to its new job + customer.
  await supabase
    .from('phone_calls')
    .update({ job_id: jobId, customer_id: customerId })
    .eq('id', call.id)
    .eq('company_id', me.company_id);

  try {
    await enqueueEventAutomation({ companyId: me.company_id, event: 'job.created', jobId });
  } catch {
    // best-effort — automation never blocks job creation
  }
  await emitEvent({
    companyId: me.company_id,
    eventKey: 'lead.created',
    title: `New lead ${jobNumber} (inbound call)`,
    linkUrl: `/dashboard/jobs/${jobId}`,
    relatedEntityType: 'job',
    relatedEntityId: jobId,
  });

  // No revalidatePath (see markCallReturned note); the redirect lands on the
  // force-dynamic job page which renders fresh.
  redirect(`/dashboard/jobs/${jobId}`);
}
