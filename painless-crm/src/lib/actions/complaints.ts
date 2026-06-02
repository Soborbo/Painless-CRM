'use server';

import { requireRole } from '@/lib/auth/require-role';
import { type ComplaintStatus, canTransition } from '@/lib/complaints/state-machine';
import { createNotification } from '@/lib/notifications/create';
import { ComplaintUpdateSchema } from '@/lib/schemas/complaint';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

const MANAGER_ROLES = ['manager', 'admin', 'super_admin'] as const;

export type ComplaintActionState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'ok' };

export const INITIAL_COMPLAINT_STATE: ComplaintActionState = { status: 'idle' };

// Advance a complaint's status / record notes / assign it. Manager+ only.
// Status changes are validated against the state machine; entering a status
// stamps the matching timestamp (first response, resolved, escalated).
export async function updateComplaint(
  _prev: ComplaintActionState,
  form: FormData,
): Promise<ComplaintActionState> {
  const me = await requireRole(MANAGER_ROLES);

  const parsed = ComplaintUpdateSchema.safeParse({
    id: form.get('id'),
    version: form.get('version'),
    status: form.get('status'),
    resolution_notes: form.get('resolution_notes') || undefined,
    assigned_to_id: form.get('assigned_to_id') || undefined,
  });
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from('complaints')
    .select('status, version, sla_first_response_at, assigned_to_id')
    .eq('id', parsed.data.id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!existing) return { status: 'error', message: 'Complaint not found' };

  const row = existing as {
    status: ComplaintStatus;
    version: number;
    sla_first_response_at: string | null;
    assigned_to_id: string | null;
  };
  if (row.version !== parsed.data.version) {
    return { status: 'error', message: 'This complaint changed elsewhere. Reload and retry.' };
  }

  const next = parsed.data.status;
  if (next !== row.status && !canTransition(row.status, next)) {
    return { status: 'error', message: `Cannot move a complaint from ${row.status} to ${next}` };
  }

  const now = new Date().toISOString();
  const update: Record<string, unknown> = {
    status: next,
    resolution_notes: parsed.data.resolution_notes ?? null,
    assigned_to_id: parsed.data.assigned_to_id ?? null,
    version: parsed.data.version + 1,
  };
  // First admin action on an unanswered complaint records the first-response SLA hit.
  if (!row.sla_first_response_at && next !== 'new') update.sla_first_response_at = now;
  if (next === 'resolved') update.resolved_at = now;
  if (next === 'escalated') update.escalated_at = now;

  const { data: saved, error } = await supabase
    .from('complaints')
    .update(update)
    .eq('id', parsed.data.id)
    .eq('version', parsed.data.version)
    .select('id, job_id, job:jobs(job_number)')
    .maybeSingle();
  if (error || !saved) {
    return { status: 'error', message: 'Could not update the complaint. Reload and retry.' };
  }

  const savedRow = saved as {
    id: string;
    job_id: string;
    job: { job_number: string } | { job_number: string }[] | null;
  };

  // Notify a newly-assigned handler (not on self-assignment or no change).
  const assignee = parsed.data.assigned_to_id ?? null;
  if (assignee && assignee !== row.assigned_to_id && assignee !== me.id) {
    const job = Array.isArray(savedRow.job) ? savedRow.job[0] : savedRow.job;
    const jobNumber = job?.job_number ?? '';
    await createNotification({
      companyId: me.company_id,
      recipientUserId: assignee,
      type: 'complaint',
      title: `You were assigned a complaint on job ${jobNumber}`,
      linkUrl: `/dashboard/jobs/${savedRow.job_id}/complaints`,
      relatedEntityType: 'complaint',
      relatedEntityId: savedRow.id,
      priority: 'high',
    });
  }

  revalidatePath('/dashboard/complaints');
  revalidatePath(`/dashboard/jobs/${savedRow.job_id}/complaints`);
  return { status: 'ok' };
}
