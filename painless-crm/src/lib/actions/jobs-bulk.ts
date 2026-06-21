'use server';

import { requireRole } from '@/lib/auth/require-role';
import { normalizeJobIds } from '@/lib/jobs/bulk';
import { BulkAssignSchema, BulkTagSchema } from '@/lib/schemas/job';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

const MANAGER_ROLES = ['manager', 'admin', 'super_admin'] as const;
const SALES_ROLES = ['sales', 'manager', 'admin', 'super_admin'] as const;

export type BulkActionState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'ok'; affected: number };

// Reassign (or unassign, when assigned_to_id is blank) a batch of jobs in one
// write. Assignment is a single column owned by managers, so this is an
// intentional last-write-wins bulk update — no per-row version guard. The audit
// trigger records each changed row.
export async function bulkAssignJobs(
  _prev: BulkActionState,
  form: FormData,
): Promise<BulkActionState> {
  const me = await requireRole(MANAGER_ROLES);
  const rep = form.get('assigned_to_id');

  const parsed = BulkAssignSchema.safeParse({
    job_ids: normalizeJobIds(form.getAll('job_id').map(String)),
    assigned_to_id: rep ? String(rep) : null,
  });
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Invalid selection' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('jobs')
    .update({ assigned_to_id: parsed.data.assigned_to_id, updated_by_id: me.id })
    .in('id', parsed.data.job_ids)
    .is('deleted_at', null)
    .select('id');
  if (error) return { status: 'error', message: 'Could not reassign the selected jobs' };

  revalidatePath('/dashboard/jobs');
  return { status: 'ok', affected: data?.length ?? 0 };
}

// Add one tag to a batch of jobs. The (job_id, tag) unique index makes the
// upsert idempotent, so re-tagging an already-tagged job is a no-op.
export async function bulkAddTag(_prev: BulkActionState, form: FormData): Promise<BulkActionState> {
  const me = await requireRole(SALES_ROLES);

  const parsed = BulkTagSchema.safeParse({
    job_ids: normalizeJobIds(form.getAll('job_id').map(String)),
    tag: form.get('tag'),
  });
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Invalid tag' };
  }

  const supabase = await createClient();
  const rows = parsed.data.job_ids.map((job_id) => ({
    company_id: me.company_id,
    job_id,
    tag: parsed.data.tag,
    added_by_id: me.id,
  }));
  const { error } = await supabase.from('job_tags').upsert(rows, { onConflict: 'job_id,tag' });
  if (error) return { status: 'error', message: 'Could not tag the selected jobs' };

  revalidatePath('/dashboard/jobs');
  return { status: 'ok', affected: parsed.data.job_ids.length };
}
