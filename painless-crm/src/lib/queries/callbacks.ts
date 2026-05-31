import { type DayWindow, todayWindow } from '@/lib/queries/home-snapshot';
import { createClient } from '@/lib/supabase/server';

// Call-back queue (Phase 06b §4 follow-ups + §10 owner home). Lists the *open*
// phone-call follow-ups — a due date that has not been completed — that are due
// by the end of today, i.e. overdue ones plus today's. The completion flag
// (migration 37) keeps this bounded: clearing a follow-up drops it from the
// set, so surfacing overdue rows no longer risks an ever-growing list.
//
// This is intentionally a superset of the owner-home "due today" count, which
// stays a same-day nudge; the queue is the full open worklist so nothing
// overdue is stranded un-clearable. The table has no deleted_at column, so
// there is nothing to soft-delete-filter. RLS scopes to company.

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

// Pure overdue test — exported so the badge logic is unit-testable. A call-back
// is overdue once its due time is before the start of today (anything still
// due *within* today is just "due", not yet late).
export function isCallbackOverdue(dueAtIso: string, now: Date = new Date()): boolean {
  return Date.parse(dueAtIso) < Date.parse(todayWindow(now).startIso);
}

export async function listOpenCallbacks(now: Date = new Date()): Promise<CallbackRow[]> {
  const window: DayWindow = todayWindow(now);
  const supabase = await createClient();
  const { data } = await supabase
    .from('phone_calls')
    .select(CALLBACK_COLUMNS)
    .not('next_action_due_at', 'is', null)
    .is('next_action_completed_at', null)
    .lt('next_action_due_at', window.endIso)
    .order('next_action_due_at', { ascending: true })
    .limit(200);
  return ((data ?? []) as Array<Record<string, unknown>>).map(flattenCallbackRow);
}
