import { type DayWindow, todayWindow } from '@/lib/queries/home-snapshot';
import { createClient } from '@/lib/supabase/server';

// Call-back queue (Phase 06b §4 follow-ups + §10 owner home). Lists the
// phone-call follow-ups whose next_action_due_at falls inside today's window —
// the exact same filter countCallbacksDueToday uses, so the owner-home banner
// count always matches this list's length.
//
// phone_calls has no "done" flag in v0.1, so scoping to today keeps the queue
// bounded (a global "all overdue" view would only ever grow). v0.2 adds a
// completion flag and a rolling overdue queue. The table has no deleted_at
// column, so there is nothing to soft-delete-filter. RLS scopes to company.

export interface CallbackCustomer {
  customer_type: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  primary_email: string | null;
}

export interface CallbackRow {
  id: string;
  next_action_due_at: string;
  next_action: string | null;
  outcome: string | null;
  direction: string;
  occurred_at: string | null;
  job_id: string | null;
  job_number: string | null;
  customer: CallbackCustomer | null;
}

const CALLBACK_COLUMNS = `
  id, next_action_due_at, next_action, outcome, direction, occurred_at, job_id,
  job:jobs (job_number),
  customer:customers (customer_type, first_name, last_name, company_name, primary_email)
`;

function embedOne<T>(raw: unknown): T | null {
  if (Array.isArray(raw)) return (raw[0] as T | undefined) ?? null;
  return (raw as T | null) ?? null;
}

// Pure flatten — exported so the PostgREST embed-shape normalisation is
// unit-testable without a live Supabase connection.
export function flattenCallbackRow(raw: Record<string, unknown>): CallbackRow {
  const job = embedOne<{ job_number?: string }>(raw.job);
  const customer = embedOne<CallbackCustomer>(raw.customer);
  return {
    id: raw.id as string,
    next_action_due_at: raw.next_action_due_at as string,
    next_action: (raw.next_action as string | null) ?? null,
    outcome: (raw.outcome as string | null) ?? null,
    direction: (raw.direction as string | null) ?? 'outbound',
    occurred_at: (raw.occurred_at as string | null) ?? null,
    job_id: (raw.job_id as string | null) ?? null,
    job_number: job?.job_number ?? null,
    customer,
  };
}

export async function listCallbacksDueToday(now: Date = new Date()): Promise<CallbackRow[]> {
  const window: DayWindow = todayWindow(now);
  const supabase = await createClient();
  const { data } = await supabase
    .from('phone_calls')
    .select(CALLBACK_COLUMNS)
    .not('next_action_due_at', 'is', null)
    .gte('next_action_due_at', window.startIso)
    .lt('next_action_due_at', window.endIso)
    .order('next_action_due_at', { ascending: true })
    .limit(200);
  return ((data ?? []) as Array<Record<string, unknown>>).map(flattenCallbackRow);
}
