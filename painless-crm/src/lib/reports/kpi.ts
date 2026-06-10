// Phase 14 — KPI tiles with period-over-period deltas for the owner home.
// Pure: window maths + delta computation so the home page can show "this
// period vs the one before" without any of the logic living in the view.
// The Supabase counts live in lib/queries/kpi.ts.
//
// Windows are rolling and symmetric: the current window is the last N days
// up to `now`, the previous is the N days immediately before it. That keeps
// the comparison apples-to-apples (same length, no calendar edge cases) and
// trivially testable.

export const KPI_PERIODS = ['day', 'week', 'month'] as const;
export type KpiPeriod = (typeof KPI_PERIODS)[number];

const PERIOD_DAYS: Record<KpiPeriod, number> = { day: 1, week: 7, month: 30 };

export function isKpiPeriod(value: unknown): value is KpiPeriod {
  return typeof value === 'string' && (KPI_PERIODS as readonly string[]).includes(value);
}

export interface KpiWindow {
  startIso: string;
  endIso: string;
}

export interface KpiWindows {
  current: KpiWindow;
  previous: KpiWindow;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function kpiWindows(now: Date, period: KpiPeriod): KpiWindows {
  const lenMs = PERIOD_DAYS[period] * DAY_MS;
  const end = now.getTime();
  const start = end - lenMs;
  const prevStart = start - lenMs;
  return {
    current: { startIso: new Date(start).toISOString(), endIso: new Date(end).toISOString() },
    previous: {
      startIso: new Date(prevStart).toISOString(),
      endIso: new Date(start).toISOString(),
    },
  };
}

/** Raw counts for one window — the shape lib/queries/kpi.ts returns. */
export interface KpiCounts {
  leads: number;
  quotesSent: number;
  quotesAccepted: number;
  won: number;
  revenuePence: number;
}

export const KPI_METRICS = [
  'leads',
  'quotesSent',
  'quotesAccepted',
  'won',
  'revenuePence',
] as const;
export type KpiMetricKey = (typeof KPI_METRICS)[number];

export interface KpiMetric {
  key: KpiMetricKey;
  current: number;
  previous: number;
  /** Percentage change vs the previous window, or null when previous was 0. */
  deltaPct: number | null;
  /** Sign of the change, for colouring; 'flat' when equal or no baseline. */
  direction: 'up' | 'down' | 'flat';
  /** True when the metric is money (render as pence). */
  isMoney: boolean;
}

function delta(current: number, previous: number): Pick<KpiMetric, 'deltaPct' | 'direction'> {
  if (current === previous) return { deltaPct: previous === 0 ? null : 0, direction: 'flat' };
  const direction = current > previous ? 'up' : 'down';
  const deltaPct = previous === 0 ? null : ((current - previous) / previous) * 100;
  return { deltaPct, direction };
}

export function buildKpiMetrics(current: KpiCounts, previous: KpiCounts): KpiMetric[] {
  return KPI_METRICS.map((key) => ({
    key,
    current: current[key],
    previous: previous[key],
    isMoney: key === 'revenuePence',
    ...delta(current[key], previous[key]),
  }));
}
