import type { KpiCounts, KpiWindow } from '@/lib/reports/kpi';
import { createClient } from '@/lib/supabase/server';

// Phase 14 — KPI counts for one window. RLS scopes every read to the caller's
// company. Leads/quotes/acceptances mirror the home-snapshot funnel; won +
// revenue come from jobs paid within the window (quote_total_pence is the
// contracted value, matching the reports funnel's "won" cohort).

async function countLeads(window: KpiWindow): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from('jobs')
    .select('id', { count: 'exact', head: true })
    .is('deleted_at', null)
    .gte('enquiry_at', window.startIso)
    .lt('enquiry_at', window.endIso);
  return count ?? 0;
}

async function countQuotesSent(window: KpiWindow): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from('quotes')
    .select('id', { count: 'exact', head: true })
    .is('deleted_at', null)
    .gte('sent_at', window.startIso)
    .lt('sent_at', window.endIso);
  return count ?? 0;
}

async function countQuotesAccepted(window: KpiWindow): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from('quote_acceptances')
    .select('id', { count: 'exact', head: true })
    .gte('accepted_at', window.startIso)
    .lt('accepted_at', window.endIso);
  return count ?? 0;
}

// Won jobs (paid within the window) and their contracted revenue. The sum is
// done in-process over a capped page — the daily/weekly/monthly cohorts are
// small, and there is no raw-SQL aggregate path in app code (CLAUDE.md §6).
async function fetchWon(window: KpiWindow): Promise<{ won: number; revenuePence: number }> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('jobs')
    .select('quote_total_pence')
    .is('deleted_at', null)
    .gte('paid_at', window.startIso)
    .lt('paid_at', window.endIso)
    .limit(5000);
  const rows = (data ?? []) as Array<{ quote_total_pence: number | null }>;
  let revenuePence = 0;
  for (const r of rows) revenuePence += r.quote_total_pence ?? 0;
  return { won: rows.length, revenuePence };
}

export async function getKpiCounts(window: KpiWindow): Promise<KpiCounts> {
  const [leads, quotesSent, quotesAccepted, wonAgg] = await Promise.all([
    countLeads(window),
    countQuotesSent(window),
    countQuotesAccepted(window),
    fetchWon(window),
  ]);
  return {
    leads,
    quotesSent,
    quotesAccepted,
    won: wonAgg.won,
    revenuePence: wonAgg.revenuePence,
  };
}
