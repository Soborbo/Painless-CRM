import { JOB_STAGES } from '@/lib/jobs/state-machine';

// Phase 21 — pure aggregators for the visual analytics dashboard. One job row
// set in, several breakdowns out, no I/O so they unit-test directly. The
// reads live in lib/queries/reports.ts (listAnalyticsJobs). See ADR-030.

export interface AnalyticsJobRow {
  stage: string;
  service_type: string | null;
  acquisition_source: string | null;
  assigned_to_id: string | null;
  assigned_to_name: string | null;
  quoted_at: string | null;
  paid_at: string | null;
  quote_total_pence: number | null;
}

export interface CategoryCount {
  key: string;
  count: number;
}

function tally(rows: readonly AnalyticsJobRow[], pick: (r: AnalyticsJobRow) => string): Map<string, number> {
  const map = new Map<string, number>();
  for (const r of rows) {
    const key = pick(r);
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return map;
}

function sortedByCount(map: Map<string, number>): CategoryCount[] {
  return [...map.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

export function byType(rows: readonly AnalyticsJobRow[]): CategoryCount[] {
  return sortedByCount(tally(rows, (r) => r.service_type ?? 'unknown'));
}

export function bySource(rows: readonly AnalyticsJobRow[]): CategoryCount[] {
  return sortedByCount(tally(rows, (r) => r.acquisition_source ?? 'unknown'));
}

// Current-stage snapshot, ordered along the canonical lifecycle rather than by
// count, so the breakdown reads left-to-right like the pipeline.
export function byStatus(rows: readonly AnalyticsJobRow[]): CategoryCount[] {
  const map = tally(rows, (r) => r.stage);
  const order = new Map(JOB_STAGES.map((s, i) => [s as string, i]));
  return [...map.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => (order.get(a.key) ?? 99) - (order.get(b.key) ?? 99) || a.key.localeCompare(b.key));
}

export interface StaffConversion {
  assignedToId: string;
  name: string;
  quoted: number;
  won: number;
  conversionPct: number | null;
}

export function quoteConversionByStaff(rows: readonly AnalyticsJobRow[]): StaffConversion[] {
  const map = new Map<string, StaffConversion>();
  for (const r of rows) {
    if (!r.quoted_at) continue; // only count reps who actually sent a quote
    const id = r.assigned_to_id ?? 'unassigned';
    let agg = map.get(id);
    if (!agg) {
      agg = {
        assignedToId: id,
        name: r.assigned_to_name ?? 'Unassigned',
        quoted: 0,
        won: 0,
        conversionPct: null,
      };
      map.set(id, agg);
    }
    agg.quoted += 1;
    if (r.paid_at) agg.won += 1;
  }
  const out = [...map.values()];
  for (const a of out) a.conversionPct = a.quoted > 0 ? (a.won / a.quoted) * 100 : null;
  out.sort((a, b) => b.quoted - a.quoted || a.name.localeCompare(b.name));
  return out;
}

// Expected value of the open pipeline: each non-terminal, unpaid job's quote
// value weighted by a stage win-probability. Documented constant map (ADR-030)
// — tune in one place. Stages absent from the map (paid + terminal) contribute
// nothing: paid is already realised revenue, terminal stages are lost.
export const WIN_PROBABILITY_BY_STAGE: Readonly<Record<string, number>> = {
  lead: 0.05,
  contacted: 0.1,
  survey_scheduled: 0.2,
  quoted: 0.35,
  accepted: 0.75,
  confirmed: 0.9,
  in_progress: 0.95,
  completed: 0.98,
  invoiced: 0.99,
};

export function projectedRevenue(rows: readonly AnalyticsJobRow[]): number {
  let total = 0;
  for (const r of rows) {
    const weight = WIN_PROBABILITY_BY_STAGE[r.stage];
    if (weight === undefined) continue;
    total += (r.quote_total_pence ?? 0) * weight;
  }
  return Math.round(total);
}
