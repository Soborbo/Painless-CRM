// Lead funnel + per-source conversion — pure aggregation. Reporting v0
// (the light slice of Phase 14 that ships in v0.1).
//
// Cohort model: a job counts toward every milestone it has *reached*, read
// from the per-stage timestamps (contacted_at, quoted_at, …). So a job that
// is now paid still counts as a lead, a quote and an acceptance. That gives a
// true conversion funnel rather than a current-stage snapshot. The Supabase
// read lives in lib/queries/reports.ts; everything here is pure + testable.

export interface ReportJobRow {
  acquisition_source: string | null;
  contacted_at: string | null;
  quoted_at: string | null;
  accepted_at: string | null;
  paid_at: string | null;
  quote_total_pence: number | null;
}

export const FUNNEL_STEPS = ['enquiries', 'contacted', 'quoted', 'accepted', 'won'] as const;
export type FunnelStepKey = (typeof FUNNEL_STEPS)[number];

export interface FunnelStep {
  key: FunnelStepKey;
  count: number;
  /** Share of the top of the funnel (enquiries), 0–100, or null when empty. */
  ofTopPct: number | null;
  /** Share of the immediately preceding step, or null for the first step. */
  ofPrevPct: number | null;
}

function pct(num: number, den: number): number | null {
  return den > 0 ? (num / den) * 100 : null;
}

export function aggregateFunnel(rows: readonly ReportJobRow[]): FunnelStep[] {
  const counts: Record<FunnelStepKey, number> = {
    enquiries: rows.length,
    contacted: 0,
    quoted: 0,
    accepted: 0,
    won: 0,
  };
  for (const r of rows) {
    if (r.contacted_at) counts.contacted += 1;
    if (r.quoted_at) counts.quoted += 1;
    if (r.accepted_at) counts.accepted += 1;
    if (r.paid_at) counts.won += 1;
  }
  const top = counts.enquiries;
  return FUNNEL_STEPS.map((key, i) => {
    const count = counts[key];
    const prevCount = i === 0 ? count : counts[FUNNEL_STEPS[i - 1] as FunnelStepKey];
    return {
      key,
      count,
      ofTopPct: pct(count, top),
      ofPrevPct: i === 0 ? null : pct(count, prevCount),
    };
  });
}

export interface SourceConversion {
  source: string;
  leads: number;
  quoted: number;
  won: number;
  /** Sum of quote_total_pence for won (paid) jobs — contracted value. */
  revenuePence: number;
  /** won / leads, 0–100, or null when no leads. */
  conversionPct: number | null;
}

export function aggregateBySource(rows: readonly ReportJobRow[]): SourceConversion[] {
  const map = new Map<string, SourceConversion>();
  for (const r of rows) {
    const source = r.acquisition_source ?? 'unknown';
    let agg = map.get(source);
    if (!agg) {
      agg = { source, leads: 0, quoted: 0, won: 0, revenuePence: 0, conversionPct: null };
      map.set(source, agg);
    }
    agg.leads += 1;
    if (r.quoted_at) agg.quoted += 1;
    if (r.paid_at) {
      agg.won += 1;
      agg.revenuePence += r.quote_total_pence ?? 0;
    }
  }
  const out = [...map.values()];
  for (const a of out) a.conversionPct = pct(a.won, a.leads);
  out.sort((a, b) => b.leads - a.leads || b.revenuePence - a.revenuePence);
  return out;
}

export interface ReportTotals {
  enquiries: number;
  quoted: number;
  won: number;
  revenuePence: number;
  conversionPct: number | null;
}

export function reportTotals(rows: readonly ReportJobRow[]): ReportTotals {
  let quoted = 0;
  let won = 0;
  let revenuePence = 0;
  for (const r of rows) {
    if (r.quoted_at) quoted += 1;
    if (r.paid_at) {
      won += 1;
      revenuePence += r.quote_total_pence ?? 0;
    }
  }
  return {
    enquiries: rows.length,
    quoted,
    won,
    revenuePence,
    conversionPct: pct(won, rows.length),
  };
}
