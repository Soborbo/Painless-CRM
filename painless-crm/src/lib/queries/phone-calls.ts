import { createClient } from '@/lib/supabase/server';

export interface PhoneCallRow {
  id: string;
  job_id: string | null;
  customer_id: string | null;
  direction: 'inbound' | 'outbound' | null;
  occurred_at: string;
  duration_seconds: number | null;
  caller_number: string | null;
  called_number: string | null;
  outcome: string | null;
  next_action: string | null;
  next_action_due_at: string | null;
  notes: string | null;
  source: 'tamar_email' | 'tamar_api' | 'manual' | null;
  user: { id: string; full_name: string } | null;
}

const COLUMNS = `
  id, job_id, customer_id, direction, occurred_at, duration_seconds,
  caller_number, called_number, outcome, next_action, next_action_due_at, notes, source,
  user:users!phone_calls_user_id_fkey (id, full_name)
`;

function flatten(raw: Record<string, unknown>): PhoneCallRow {
  const userRaw = raw.user as unknown;
  const user = Array.isArray(userRaw)
    ? ((userRaw[0] as { id: string; full_name: string } | undefined) ?? null)
    : ((userRaw as { id: string; full_name: string } | null) ?? null);
  return {
    id: raw.id as string,
    job_id: (raw.job_id as string | null) ?? null,
    customer_id: (raw.customer_id as string | null) ?? null,
    direction: (raw.direction as PhoneCallRow['direction']) ?? null,
    occurred_at: raw.occurred_at as string,
    duration_seconds: (raw.duration_seconds as number | null) ?? null,
    caller_number: (raw.caller_number as string | null) ?? null,
    called_number: (raw.called_number as string | null) ?? null,
    outcome: (raw.outcome as string | null) ?? null,
    next_action: (raw.next_action as string | null) ?? null,
    next_action_due_at: (raw.next_action_due_at as string | null) ?? null,
    notes: (raw.notes as string | null) ?? null,
    source: (raw.source as PhoneCallRow['source']) ?? null,
    user,
  };
}

export async function listPhoneCallsForJob(jobId: string): Promise<PhoneCallRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('phone_calls')
    .select(COLUMNS)
    .eq('job_id', jobId)
    .order('occurred_at', { ascending: false })
    .limit(50);
  return ((data ?? []) as Array<Record<string, unknown>>).map(flatten);
}
