import { ACTIVE_STAGES, type RepLoad, type SalesRep } from '@/lib/jobs/routing';
import type { JobStage } from '@/lib/jobs/state-machine';
import { JOB_PAGE_SIZE, type JobListFilters } from '@/lib/schemas/job';
import { createClient } from '@/lib/supabase/server';

export type JobRow = {
  id: string;
  job_number: string;
  customer_id: string;
  stage: JobStage;
  sub_status: string | null;
  acquisition_source: string | null;
  assigned_to_id: string | null;
  surveyor_id: string | null;
  move_date: string | null;
  enquiry_at: string | null;
  accepted_at: string | null;
  quote_total_pence: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  version: number;
};

export type JobListRow = JobRow & {
  first_response_due_at: string | null;
  first_response_at: string | null;
  customer: {
    id: string;
    customer_type: string;
    first_name: string | null;
    last_name: string | null;
    company_name: string | null;
    primary_email: string | null;
  } | null;
  assigned_to: { id: string; full_name: string } | null;
  tags: string[];
};

export type JobListResult = {
  rows: JobListRow[];
  total: number;
  page: number;
  pageSize: number;
};

const LIST_COLUMNS = `
  id, job_number, customer_id, stage, sub_status, acquisition_source,
  assigned_to_id, surveyor_id, move_date, enquiry_at, accepted_at, quote_total_pence,
  first_response_due_at, first_response_at,
  notes, created_at, updated_at, version,
  customer:customers (id, customer_type, first_name, last_name, company_name, primary_email),
  assigned_to:users!jobs_assigned_to_id_fkey (id, full_name),
  job_tags (tag)
`;

type RawJobListRow = Omit<JobListRow, 'tags'> & {
  job_tags: { tag: string }[] | null;
};

function flattenTags(rows: RawJobListRow[]): JobListRow[] {
  return rows.map(({ job_tags, ...rest }) => ({
    ...rest,
    tags: (job_tags ?? []).map((t) => t.tag),
  }));
}

const DETAIL_COLUMNS = `
  id, job_number, customer_id, stage, sub_status, acquisition_source,
  assigned_to_id, surveyor_id, move_date, enquiry_at, contacted_at, quoted_at,
  accepted_at, confirmed_at, in_progress_at, completed_at, invoiced_at, paid_at,
  declined_at, dead_at, cancelled_at, decline_reason, cancellation_reason,
  deposit_refund_decision, quote_total_pence, parent_job_id,
  first_response_due_at, first_response_at, notes,
  created_at, updated_at, version,
  customer:customers (id, customer_type, first_name, last_name, company_name, primary_email, primary_phone),
  assigned_to:users!jobs_assigned_to_id_fkey (id, full_name),
  surveyor:users!jobs_surveyor_id_fkey (id, full_name),
  parent:jobs!jobs_parent_job_id_fkey (id, job_number, stage)
`;

export async function listJobs(filters: JobListFilters): Promise<JobListResult> {
  const supabase = await createClient();
  const from = (filters.page - 1) * JOB_PAGE_SIZE;
  const to = from + JOB_PAGE_SIZE - 1;

  let query = supabase
    .from('jobs')
    .select(LIST_COLUMNS, { count: 'exact' })
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (filters.stage) query = query.eq('stage', filters.stage);
  if (filters.assigned_to_id) query = query.eq('assigned_to_id', filters.assigned_to_id);
  if (filters.move_from) query = query.gte('move_date', `${filters.move_from}T00:00:00.000Z`);
  if (filters.move_to) query = query.lte('move_date', `${filters.move_to}T23:59:59.999Z`);
  if (filters.q) {
    const safe = filters.q.replace(/[%_,]/g, ' ');
    const pattern = `%${safe}%`;
    query = query.or([`job_number.ilike.${pattern}`, `notes.ilike.${pattern}`].join(','));
  }

  const { data, count } = await query;
  return {
    rows: flattenTags((data ?? []) as unknown as RawJobListRow[]),
    total: count ?? 0,
    page: filters.page,
    pageSize: JOB_PAGE_SIZE,
  };
}

export type KanbanFilters = Omit<JobListFilters, 'page' | 'stage'>;

export const KANBAN_PER_STAGE_LIMIT = 200;

export const JOBS_EXPORT_MAX = 10_000;

export async function listJobsForExport(
  filters: Omit<JobListFilters, 'page'>,
): Promise<JobListRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from('jobs')
    .select(LIST_COLUMNS)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(JOBS_EXPORT_MAX);

  if (filters.stage) query = query.eq('stage', filters.stage);
  if (filters.assigned_to_id) query = query.eq('assigned_to_id', filters.assigned_to_id);
  if (filters.move_from) query = query.gte('move_date', `${filters.move_from}T00:00:00.000Z`);
  if (filters.move_to) query = query.lte('move_date', `${filters.move_to}T23:59:59.999Z`);
  if (filters.q) {
    const safe = filters.q.replace(/[%_,]/g, ' ');
    const pattern = `%${safe}%`;
    query = query.or([`job_number.ilike.${pattern}`, `notes.ilike.${pattern}`].join(','));
  }

  const { data } = await query;
  return flattenTags((data ?? []) as unknown as RawJobListRow[]);
}

export async function listJobsForKanban(filters: KanbanFilters): Promise<JobListRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from('jobs')
    .select(LIST_COLUMNS)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(KANBAN_PER_STAGE_LIMIT * 13);

  if (filters.assigned_to_id) query = query.eq('assigned_to_id', filters.assigned_to_id);
  if (filters.move_from) query = query.gte('move_date', `${filters.move_from}T00:00:00.000Z`);
  if (filters.move_to) query = query.lte('move_date', `${filters.move_to}T23:59:59.999Z`);
  if (filters.q) {
    const safe = filters.q.replace(/[%_,]/g, ' ');
    const pattern = `%${safe}%`;
    query = query.or([`job_number.ilike.${pattern}`, `notes.ilike.${pattern}`].join(','));
  }

  const { data } = await query;
  return flattenTags((data ?? []) as unknown as RawJobListRow[]);
}

export type JobDetail = Omit<JobListRow, 'customer' | 'tags'> & {
  contacted_at: string | null;
  quoted_at: string | null;
  accepted_at: string | null;
  confirmed_at: string | null;
  in_progress_at: string | null;
  completed_at: string | null;
  invoiced_at: string | null;
  paid_at: string | null;
  declined_at: string | null;
  dead_at: string | null;
  cancelled_at: string | null;
  decline_reason: string | null;
  cancellation_reason: string | null;
  deposit_refund_decision: string | null;
  parent_job_id: string | null;
  customer: (NonNullable<JobListRow['customer']> & { primary_phone: string | null }) | null;
  surveyor: { id: string; full_name: string } | null;
  parent: { id: string; job_number: string; stage: string } | null;
};

export type ChildJobSummary = {
  id: string;
  job_number: string;
  stage: string;
  created_at: string;
};

export async function listChildJobs(parentJobId: string): Promise<ChildJobSummary[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('jobs')
    .select('id, job_number, stage, created_at')
    .eq('parent_job_id', parentJobId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(20);
  return (data ?? []) as ChildJobSummary[];
}

export async function getJobById(id: string): Promise<JobDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('jobs')
    .select(DETAIL_COLUMNS)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  return (data as unknown as JobDetail | null) ?? null;
}

export type JobStatusEntry = {
  id: string;
  from_stage: string | null;
  to_stage: string;
  changed_at: string;
  reason: string | null;
  changed_by: { id: string; full_name: string } | null;
};

export async function getJobStatusHistory(jobId: string): Promise<JobStatusEntry[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('job_status_history')
    .select(
      'id, from_stage, to_stage, changed_at, reason, changed_by:users!job_status_history_changed_by_id_fkey (id, full_name)',
    )
    .eq('job_id', jobId)
    .order('changed_at', { ascending: false })
    .limit(100);
  return (data ?? []) as unknown as JobStatusEntry[];
}

export async function getJobTags(jobId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('job_tags')
    .select('tag')
    .eq('job_id', jobId)
    .order('added_at', { ascending: true });
  return (data ?? []).map((r) => r.tag as string);
}

export async function listSalesReps(): Promise<SalesRep[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('users')
    .select('id, full_name, active, role')
    .in('role', ['sales', 'manager', 'admin', 'super_admin'])
    .eq('active', true)
    .order('full_name', { ascending: true });
  return (data ?? []).map((r) => ({
    id: r.id as string,
    full_name: r.full_name as string,
    active: r.active as boolean,
  }));
}

export async function listSurveyors(): Promise<SalesRep[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('users')
    .select('id, full_name, active, role')
    .in('role', ['surveyor', 'manager', 'admin', 'super_admin'])
    .eq('active', true)
    .order('full_name', { ascending: true });
  return (data ?? []).map((r) => ({
    id: r.id as string,
    full_name: r.full_name as string,
    active: r.active as boolean,
  }));
}

export async function getRepLoads(repIds: readonly string[]): Promise<RepLoad[]> {
  if (repIds.length === 0) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from('jobs')
    .select('assigned_to_id')
    .is('deleted_at', null)
    .in('stage', [...ACTIVE_STAGES])
    .in('assigned_to_id', [...repIds]);

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const repId = row.assigned_to_id as string | null;
    if (!repId) continue;
    counts.set(repId, (counts.get(repId) ?? 0) + 1);
  }
  return Array.from(counts, ([rep_id, active_count]) => ({ rep_id, active_count }));
}

export async function getLastAssignedRepId(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('jobs')
    .select('assigned_to_id, created_at')
    .is('deleted_at', null)
    .not('assigned_to_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.assigned_to_id as string | null) ?? null;
}

export async function getNextJobNumber(): Promise<string> {
  const supabase = await createClient();
  const year = new Date().getUTCFullYear();
  const { data } = await supabase
    .from('jobs')
    .select('job_number')
    .ilike('job_number', `J${year}-%`)
    .order('job_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  let nextSeq = 1;
  if (data?.job_number) {
    const match = /J\d{4}-(\d+)/.exec(data.job_number as string);
    if (match?.[1]) nextSeq = Number.parseInt(match[1], 10) + 1;
  }
  return `J${year}-${String(nextSeq).padStart(5, '0')}`;
}
