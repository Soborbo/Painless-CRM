import { createClient } from '@/lib/supabase/server';

// Reads for the office "Move brief" panel (ADR-045): the structured kit /
// "not going" lists and the job's calendar-sync status. RLS scopes both to the
// caller's company.

export interface BriefItemRow {
  id: string;
  kind: 'kit' | 'excluded';
  item: string;
  quantity: number;
  notes: string | null;
}

export async function listBriefItemsForJob(
  jobId: string,
): Promise<{ kit: BriefItemRow[]; excluded: BriefItemRow[] }> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('job_brief_items')
    .select('id, kind, item, quantity, notes')
    .eq('job_id', jobId)
    .is('deleted_at', null)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  const rows = (data ?? []) as BriefItemRow[];
  return {
    kit: rows.filter((r) => r.kind === 'kit'),
    excluded: rows.filter((r) => r.kind === 'excluded'),
  };
}

export interface JobCalendarStatus {
  status: 'pending' | 'synced' | 'failed' | 'deleted';
  lastSyncedAt: string | null;
  lastError: string | null;
  htmlLink: string | null;
}

export async function getJobCalendarStatus(jobId: string): Promise<JobCalendarStatus | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('calendar_links')
    .select('status, last_synced_at, last_error, html_link')
    .eq('provider', 'google')
    .eq('entity_type', 'job_move')
    .eq('entity_id', jobId)
    .maybeSingle();
  if (!data) return null;
  const r = data as {
    status: JobCalendarStatus['status'];
    last_synced_at: string | null;
    last_error: string | null;
    html_link: string | null;
  };
  return {
    status: r.status,
    lastSyncedAt: r.last_synced_at,
    lastError: r.last_error,
    htmlLink: r.html_link,
  };
}
