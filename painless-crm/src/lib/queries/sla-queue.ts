import { computeSLAStatus } from '@/lib/jobs/sla';
import { createClient } from '@/lib/supabase/server';

// Lead-funnel SLA queue: jobs in lead/contacted that have a deadline and
// haven't yet been responded to. Backs `/dashboard/sla` (Phase 06b §1) and
// — once Realtime wiring lands — the live ticking list.

export interface SlaQueueRow {
  id: string;
  job_number: string;
  stage: 'lead' | 'contacted';
  acquisition_source: string | null;
  enquiry_at: string | null;
  first_response_due_at: string;
  customer: {
    id: string;
    customer_type: string;
    first_name: string | null;
    last_name: string | null;
    company_name: string | null;
    primary_email: string | null;
  } | null;
  assigned_to: { id: string; full_name: string } | null;
}

const COLUMNS = `
  id, job_number, stage, acquisition_source, enquiry_at, first_response_due_at,
  customer:customers (id, customer_type, first_name, last_name, company_name, primary_email),
  assigned_to:users!jobs_assigned_to_id_fkey (id, full_name)
`;

export interface SlaQueueFilters {
  assignedToId?: string | null;
  limit?: number;
}

export async function listSlaQueue(filters: SlaQueueFilters = {}): Promise<SlaQueueRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from('jobs')
    .select(COLUMNS)
    .is('deleted_at', null)
    .is('first_response_at', null)
    .not('first_response_due_at', 'is', null)
    .in('stage', ['lead', 'contacted'])
    .order('first_response_due_at', { ascending: true })
    .limit(filters.limit ?? 200);

  if (filters.assignedToId) query = query.eq('assigned_to_id', filters.assignedToId);

  const { data } = await query;
  return (data ?? []) as unknown as SlaQueueRow[];
}

export interface SlaQueueBuckets {
  overdue: SlaQueueRow[];
  dueSoon: SlaQueueRow[];
  onTrack: SlaQueueRow[];
}

export function bucketSlaQueue(rows: SlaQueueRow[], now: Date = new Date()): SlaQueueBuckets {
  const overdue: SlaQueueRow[] = [];
  const dueSoon: SlaQueueRow[] = [];
  const onTrack: SlaQueueRow[] = [];
  for (const row of rows) {
    const status = computeSLAStatus({
      firstResponseDueAt: row.first_response_due_at,
      firstResponseAt: null,
      enquiryAt: row.enquiry_at,
      now,
    });
    if (status === 'breach') overdue.push(row);
    else if (status === 'warn') dueSoon.push(row);
    else onTrack.push(row);
  }
  return { overdue, dueSoon, onTrack };
}
