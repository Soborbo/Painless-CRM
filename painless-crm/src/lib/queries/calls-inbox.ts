import { normalizePhone } from '@/lib/migration/normalize';
import { createClient } from '@/lib/supabase/server';

// Call inbox (ADR-041): this tenant's inbound calls, newest first, each annotated
// with who it matched (customer + most-recent job), whether it has been called
// back (returned_by/at), and how many times that number has called in the window.

export interface InboxCustomer {
  customer_type: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  primary_email: string | null;
}

export interface CallInboxRow {
  id: string;
  occurred_at: string;
  duration_seconds: number | null;
  caller_number: string | null;
  source: string | null;
  customer_id: string | null;
  job_id: string | null;
  job_number: string | null;
  customer: InboxCustomer | null;
  returned_at: string | null;
  returned_by: { id: string; full_name: string } | null;
  repeatCount: number;
}

const COLUMNS = `
  id, occurred_at, duration_seconds, caller_number, source, customer_id, job_id, returned_at,
  job:jobs (job_number),
  customer:customers (customer_type, first_name, last_name, company_name, primary_email),
  returned_by:users!phone_calls_returned_by_id_fkey (id, full_name)
`;

function embedOne<T>(raw: unknown): T | null {
  if (Array.isArray(raw)) return (raw[0] as T | undefined) ?? null;
  return (raw as T | null) ?? null;
}

/** Annotate each row with how many rows in the set share its caller number
 *  (normalised). Pure + exported so the grouping is unit-testable. */
export function annotateRepeatCounts<T extends { caller_number: string | null }>(
  rows: T[],
): Array<T & { repeatCount: number }> {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const key = normalizePhone(r.caller_number);
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return rows.map((r) => {
    const key = normalizePhone(r.caller_number);
    return { ...r, repeatCount: key ? (counts.get(key) ?? 1) : 1 };
  });
}

function flatten(raw: Record<string, unknown>): Omit<CallInboxRow, 'repeatCount'> {
  const job = embedOne<{ job_number?: string }>(raw.job);
  const customer = embedOne<InboxCustomer>(raw.customer);
  const returnedBy = embedOne<{ id: string; full_name: string }>(raw.returned_by);
  return {
    id: raw.id as string,
    occurred_at: raw.occurred_at as string,
    duration_seconds: (raw.duration_seconds as number | null) ?? null,
    caller_number: (raw.caller_number as string | null) ?? null,
    source: (raw.source as string | null) ?? null,
    customer_id: (raw.customer_id as string | null) ?? null,
    job_id: (raw.job_id as string | null) ?? null,
    job_number: job?.job_number ?? null,
    customer,
    returned_at: (raw.returned_at as string | null) ?? null,
    returned_by: returnedBy,
  };
}

export async function listInboundCalls(limit = 200): Promise<CallInboxRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('phone_calls')
    .select(COLUMNS)
    .eq('direction', 'inbound')
    .order('occurred_at', { ascending: false })
    .limit(limit);
  const rows = ((data ?? []) as Array<Record<string, unknown>>).map(flatten);
  return annotateRepeatCounts(rows);
}
