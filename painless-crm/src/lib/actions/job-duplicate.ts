'use server';

import type { JobActionState } from '@/lib/actions/jobs';
import { requireRole } from '@/lib/auth/require-role';
import { computeFirstResponseDueAt } from '@/lib/jobs/sla-deadline';
import { getNextJobNumber } from '@/lib/queries/jobs';
import { DuplicateJobSchema } from '@/lib/schemas/job';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

const SALES_ROLES = ['sales', 'manager', 'admin', 'super_admin'] as const;

// Duplicates a job into a fresh lead: copies the customer, source, estimates
// and addresses, but NOT quotes/invoices/history. Intentionally does not fire
// the job.created automation — a duplicate is an office shortcut, not a new
// enquiry, so the customer must not get another welcome email.
export async function duplicateJob(
  _prev: JobActionState,
  form: FormData,
): Promise<JobActionState> {
  const me = await requireRole(SALES_ROLES);

  const parsed = DuplicateJobSchema.safeParse({ id: form.get('id') });
  if (!parsed.success) return { status: 'error', message: 'Invalid input' };

  const supabase = await createClient();
  const { data: source } = await supabase
    .from('jobs')
    .select(
      'id, job_number, customer_id, acquisition_source, service_type, assigned_to_id, estimated_cubic_ft, estimated_hours, estimated_distance_miles, arrival_window, notes',
    )
    .eq('id', parsed.data.id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!source) return { status: 'error', message: 'Job not found' };

  const enquiryAt = new Date().toISOString();
  let created: { id: string } | null = null;
  // Same read-max-then-insert retry as createJob: concurrent creates can
  // collide on the unique (company_id, job_number).
  for (let attempt = 0; attempt < 3 && !created; attempt += 1) {
    const jobNumber = await getNextJobNumber();
    const res = await supabase
      .from('jobs')
      .insert({
        job_number: jobNumber,
        customer_id: source.customer_id,
        stage: 'lead',
        acquisition_source: source.acquisition_source,
        service_type: source.service_type,
        assigned_to_id: source.assigned_to_id,
        estimated_cubic_ft: source.estimated_cubic_ft,
        estimated_hours: source.estimated_hours,
        estimated_distance_miles: source.estimated_distance_miles,
        arrival_window: source.arrival_window,
        notes: source.notes,
        enquiry_at: enquiryAt,
        first_response_due_at: computeFirstResponseDueAt(
          enquiryAt,
          source.acquisition_source as string | null,
        ),
        company_id: me.company_id,
        created_by_id: me.id,
        updated_by_id: me.id,
      })
      .select('id')
      .single();
    if (!res.error && res.data) {
      created = res.data as { id: string };
      break;
    }
    if (res.error && res.error.code !== '23505') {
      return { status: 'error', message: 'Could not duplicate job' };
    }
  }
  if (!created) return { status: 'error', message: 'Could not duplicate job' };

  const { data: addresses } = await supabase
    .from('job_addresses')
    .select('address_id, role, sequence, property_type, floor, has_lift, has_parking, access_notes')
    .eq('job_id', source.id)
    .is('deleted_at', null);
  if (addresses && addresses.length > 0) {
    await supabase.from('job_addresses').insert(
      addresses.map((a) => ({ ...a, job_id: created.id, company_id: me.company_id })),
    );
  }

  await supabase.from('job_status_history').insert({
    company_id: me.company_id,
    job_id: created.id,
    from_stage: null,
    to_stage: 'lead',
    changed_by_id: me.id,
    reason: `Duplicated from ${source.job_number}`,
  });

  revalidatePath('/dashboard/jobs');
  redirect(`/dashboard/jobs/${created.id}`);
}
