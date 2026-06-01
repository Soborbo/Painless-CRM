import { createClient } from '@/lib/supabase/server';
import { customerDisplayName } from '@/lib/utils/format';

// Phase 11 §5 — admin complaint reads. RLS scopes everything to the company.

export interface ComplaintRow {
  id: string;
  status: 'new' | 'investigating' | 'resolved' | 'escalated';
  severity: string | null;
  severity_self_assessed: string | null;
  description: string;
  customer_name: string;
  job_id: string;
  job_number: string | null;
  created_at: string;
  sla_first_response_due_at: string | null;
  sla_first_response_at: string | null;
  resolution_notes: string | null;
  assigned_to_id: string | null;
  version: number;
}

const SELECT =
  'id, status, severity, severity_self_assessed, description, job_id, created_at, ' +
  'sla_first_response_due_at, sla_first_response_at, resolution_notes, assigned_to_id, version, ' +
  'customer:customers(customer_type, first_name, last_name, company_name, primary_email), ' +
  'job:jobs(job_number)';

function embed<T>(raw: unknown): T | null {
  if (Array.isArray(raw)) return (raw[0] as T) ?? null;
  return (raw as T) ?? null;
}

function toRow(raw: Record<string, unknown>): ComplaintRow {
  const customer = embed<Parameters<typeof customerDisplayName>[0]>(raw.customer);
  const job = embed<{ job_number: string | null }>(raw.job);
  return {
    id: raw.id as string,
    status: raw.status as ComplaintRow['status'],
    severity: (raw.severity as string | null) ?? null,
    severity_self_assessed: (raw.severity_self_assessed as string | null) ?? null,
    description: raw.description as string,
    customer_name: customer ? customerDisplayName(customer) : 'Unknown customer',
    job_id: raw.job_id as string,
    job_number: job?.job_number ?? null,
    created_at: raw.created_at as string,
    sla_first_response_due_at: (raw.sla_first_response_due_at as string | null) ?? null,
    sla_first_response_at: (raw.sla_first_response_at as string | null) ?? null,
    resolution_notes: (raw.resolution_notes as string | null) ?? null,
    assigned_to_id: (raw.assigned_to_id as string | null) ?? null,
    version: (raw.version as number) ?? 1,
  };
}

export async function listComplaints(): Promise<ComplaintRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('complaints')
    .select(SELECT)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(500);
  return ((data ?? []) as unknown as Array<Record<string, unknown>>).map(toRow);
}

export async function getComplaintsForJob(jobId: string): Promise<ComplaintRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('complaints')
    .select(SELECT)
    .eq('job_id', jobId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  return ((data ?? []) as unknown as Array<Record<string, unknown>>).map(toRow);
}
