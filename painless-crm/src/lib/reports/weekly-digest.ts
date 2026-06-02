// Phase 14 — weekly performance digest. Pure composition: groups a fortnight
// of activity by company, computes this-week-vs-last-week KPIs per tenant
// (reusing buildKpiMetrics), and renders one plain-text email per company that
// has both recipients and activity. The cron route + query layer supply
// already-resolved rows so this stays unit-testable without Supabase/Resend.

import { type KpiCounts, type KpiWindows, buildKpiMetrics } from '@/lib/reports/kpi';
import { formatPence } from '@/lib/utils/format';

export interface DigestLeadJob {
  company_id: string;
  enquiry_at: string | null;
}
export interface DigestWonJob {
  company_id: string;
  paid_at: string | null;
  quote_total_pence: number | null;
}
export interface DigestQuote {
  company_id: string;
  sent_at: string | null;
}
export interface DigestAcceptance {
  company_id: string;
  accepted_at: string | null;
}
export interface DigestManager {
  company_id: string;
  email: string;
}

export interface WeeklyDigest {
  companyId: string;
  recipients: string[];
  subject: string;
  text: string;
}

export interface WeeklyDigestInput {
  leadJobs: readonly DigestLeadJob[];
  wonJobs: readonly DigestWonJob[];
  quotes: readonly DigestQuote[];
  acceptances: readonly DigestAcceptance[];
  managers: readonly DigestManager[];
  windows: KpiWindows;
  now: Date;
}

function emptyCounts(): KpiCounts {
  return { leads: 0, quotesSent: 0, quotesAccepted: 0, won: 0, revenuePence: 0 };
}

type CompanyCounts = { current: KpiCounts; previous: KpiCounts };

function inWindow(iso: string | null, win: { startIso: string; endIso: string }): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= new Date(win.startIso).getTime() && t < new Date(win.endIso).getTime();
}

function bump(
  map: Map<string, CompanyCounts>,
  companyId: string,
  iso: string | null,
  windows: KpiWindows,
  apply: (counts: KpiCounts) => void,
): void {
  const slot =
    (inWindow(iso, windows.current) && 'current') ||
    (inWindow(iso, windows.previous) && 'previous') ||
    null;
  if (!slot) return;
  let entry = map.get(companyId);
  if (!entry) {
    entry = { current: emptyCounts(), previous: emptyCounts() };
    map.set(companyId, entry);
  }
  apply(entry[slot]);
}

function recipientsByCompany(managers: readonly DigestManager[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const m of managers) {
    if (!m.email) continue;
    const list = out.get(m.company_id) ?? [];
    if (!list.includes(m.email)) list.push(m.email);
    out.set(m.company_id, list);
  }
  return out;
}

function formatDelta(deltaPct: number | null, direction: 'up' | 'down' | 'flat'): string {
  if (deltaPct === null) return 'no prior week';
  const arrow = direction === 'up' ? '↑' : direction === 'down' ? '↓' : '→';
  return `${arrow} ${Math.abs(deltaPct).toFixed(0)}% vs last week`;
}

const METRIC_LABELS: Record<keyof KpiCounts, string> = {
  leads: 'Leads',
  quotesSent: 'Quotes sent',
  quotesAccepted: 'Quotes accepted',
  won: 'Jobs won',
  revenuePence: 'Revenue won',
};

function composeText(counts: CompanyCounts, windows: KpiWindows): string {
  const metrics = buildKpiMetrics(counts.current, counts.previous);
  const lines = metrics.map((m) => {
    const value = m.isMoney ? formatPence(m.current) : String(m.current);
    return `${METRIC_LABELS[m.key]}: ${value} (${formatDelta(m.deltaPct, m.direction)})`;
  });
  const start = windows.current.startIso.slice(0, 10);
  const end = windows.current.endIso.slice(0, 10);
  return [
    `Your week in numbers (${start} → ${end}):`,
    '',
    ...lines,
    '',
    'Full reports: /dashboard/reports',
  ].join('\n');
}

export function buildWeeklyDigests(input: WeeklyDigestInput): WeeklyDigest[] {
  const { windows } = input;
  const counts = new Map<string, CompanyCounts>();

  for (const j of input.leadJobs) {
    bump(counts, j.company_id, j.enquiry_at, windows, (c) => {
      c.leads += 1;
    });
  }
  for (const q of input.quotes) {
    bump(counts, q.company_id, q.sent_at, windows, (c) => {
      c.quotesSent += 1;
    });
  }
  for (const a of input.acceptances) {
    bump(counts, a.company_id, a.accepted_at, windows, (c) => {
      c.quotesAccepted += 1;
    });
  }
  for (const w of input.wonJobs) {
    bump(counts, w.company_id, w.paid_at, windows, (c) => {
      c.won += 1;
      c.revenuePence += w.quote_total_pence ?? 0;
    });
  }

  const recipients = recipientsByCompany(input.managers);
  const digests: WeeklyDigest[] = [];
  for (const [companyId, companyCounts] of counts) {
    const to = recipients.get(companyId);
    if (!to || to.length === 0) continue;
    // Skip companies with no activity this week — don't email an empty digest.
    const cur = companyCounts.current;
    if (cur.leads + cur.quotesSent + cur.quotesAccepted + cur.won === 0) continue;
    digests.push({
      companyId,
      recipients: to,
      subject: `Weekly summary — ${cur.won} won, ${cur.leads} new leads`,
      text: composeText(companyCounts, windows),
    });
  }
  return digests;
}
