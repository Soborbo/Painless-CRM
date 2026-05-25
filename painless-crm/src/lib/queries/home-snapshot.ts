import { createClient } from '@/lib/supabase/server';

// Owner daily home: one screen telling Jay how it's going right now.
// Phase 06b §10. Five sections fetched in parallel: yesterday's funnel
// counts, SLA-overdue banner, today's moves, cash outstanding, and the
// profit-review backlog.
//
// The window helpers and the cash bucketer are pulled out so they stay
// pure (and unit-testable). The Supabase queries are thin — RLS scopes
// every read to the caller's company automatically.

export interface DayWindow {
  startIso: string;
  endIso: string;
}

export function last24hWindow(now: Date): DayWindow {
  const end = now;
  const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

export function todayWindow(now: Date): DayWindow {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

export interface TodayMoveRow {
  id: string;
  job_number: string;
  move_date: string;
  stage: string;
  customer: {
    id: string;
    customer_type: string;
    first_name: string | null;
    last_name: string | null;
    company_name: string | null;
    primary_email: string | null;
  } | null;
}

export interface CashTotals {
  outstandingPence: number;
  overduePence: number;
  outstandingCount: number;
  overdueCount: number;
}

export interface HomeSnapshot {
  newLeadsCount: number;
  quotesSentCount: number;
  quotesAcceptedCount: number;
  slaOverdueCount: number;
  todaysMoves: TodayMoveRow[];
  cash: CashTotals;
  profitReviewPending: number;
}

export function bucketCashTotals(
  rows: readonly { amount_outstanding_pence: number | null; due_at: string | null }[],
  now: Date,
): CashTotals {
  const nowMs = now.getTime();
  let outstanding = 0;
  let overdue = 0;
  let outstandingCount = 0;
  let overdueCount = 0;
  for (const row of rows) {
    const remaining = row.amount_outstanding_pence ?? 0;
    if (remaining <= 0) continue;
    outstanding += remaining;
    outstandingCount += 1;
    if (row.due_at && new Date(row.due_at).getTime() < nowMs) {
      overdue += remaining;
      overdueCount += 1;
    }
  }
  return {
    outstandingPence: outstanding,
    overduePence: overdue,
    outstandingCount,
    overdueCount,
  };
}

async function countNewLeads(window: DayWindow): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from('jobs')
    .select('id', { count: 'exact', head: true })
    .is('deleted_at', null)
    .gte('enquiry_at', window.startIso)
    .lt('enquiry_at', window.endIso);
  return count ?? 0;
}

async function countQuotesByStatusChange(
  column: 'sent_at' | 'accepted_at',
  window: DayWindow,
): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from('quotes')
    .select('id', { count: 'exact', head: true })
    .is('deleted_at', null)
    .gte(column, window.startIso)
    .lt(column, window.endIso);
  return count ?? 0;
}

async function countSlaOverdue(now: Date): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from('jobs')
    .select('id', { count: 'exact', head: true })
    .is('deleted_at', null)
    .is('first_response_at', null)
    .in('stage', ['lead', 'contacted'])
    .lt('first_response_due_at', now.toISOString());
  return count ?? 0;
}

async function listTodaysMoves(window: DayWindow): Promise<TodayMoveRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('jobs')
    .select(
      'id, job_number, move_date, stage, customer:customers (id, customer_type, first_name, last_name, company_name, primary_email)',
    )
    .is('deleted_at', null)
    .in('stage', ['confirmed', 'in_progress'])
    .gte('move_date', window.startIso)
    .lt('move_date', window.endIso)
    .order('move_date', { ascending: true })
    .limit(20);
  return (data ?? []) as unknown as TodayMoveRow[];
}

async function fetchCashTotals(now: Date): Promise<CashTotals> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('invoices')
    .select('amount_outstanding_pence, due_at')
    .is('deleted_at', null)
    .in('status', ['sent', 'partial', 'overdue']);
  return bucketCashTotals(data ?? [], now);
}

async function countProfitReviewPending(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from('jobs')
    .select('id', { count: 'exact', head: true })
    .is('deleted_at', null)
    .eq('profit_review_status', 'pending')
    .in('stage', ['completed', 'invoiced', 'paid']);
  return count ?? 0;
}

export async function getHomeSnapshot(now: Date = new Date()): Promise<HomeSnapshot> {
  const last24 = last24hWindow(now);
  const today = todayWindow(now);
  const [
    newLeadsCount,
    quotesSentCount,
    quotesAcceptedCount,
    slaOverdueCount,
    todaysMoves,
    cash,
    profitReviewPending,
  ] = await Promise.all([
    countNewLeads(last24),
    countQuotesByStatusChange('sent_at', last24),
    countQuotesByStatusChange('accepted_at', last24),
    countSlaOverdue(now),
    listTodaysMoves(today),
    fetchCashTotals(now),
    countProfitReviewPending(),
  ]);
  return {
    newLeadsCount,
    quotesSentCount,
    quotesAcceptedCount,
    slaOverdueCount,
    todaysMoves,
    cash,
    profitReviewPending,
  };
}
