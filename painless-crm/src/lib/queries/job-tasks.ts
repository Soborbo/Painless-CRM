import { createClient } from '@/lib/supabase/server';

// Phase 19 — job task checklist reads. RLS scopes to the company.

export interface JobTaskRow {
  id: string;
  title: string;
  done: boolean;
  due_date: string | null;
  sort_order: number;
  assigned_to: { id: string; full_name: string } | null;
}

const COLUMNS = `
  id, title, done, due_date, sort_order,
  assigned_to:users!job_tasks_assigned_to_id_fkey (id, full_name)
`;

function flatten(raw: Record<string, unknown>): JobTaskRow {
  const assigneeRaw = raw.assigned_to as unknown;
  const assignedTo = Array.isArray(assigneeRaw)
    ? ((assigneeRaw[0] as { id: string; full_name: string } | undefined) ?? null)
    : ((assigneeRaw as { id: string; full_name: string } | null) ?? null);
  return {
    id: raw.id as string,
    title: raw.title as string,
    done: Boolean(raw.done),
    due_date: (raw.due_date as string | null) ?? null,
    sort_order: (raw.sort_order as number | null) ?? 0,
    assigned_to: assignedTo,
  };
}

export async function listTasksForJob(jobId: string): Promise<JobTaskRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('job_tasks')
    .select(COLUMNS)
    .eq('job_id', jobId)
    .is('deleted_at', null)
    .order('done', { ascending: true })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(200);
  return ((data ?? []) as Array<Record<string, unknown>>).map(flatten);
}
