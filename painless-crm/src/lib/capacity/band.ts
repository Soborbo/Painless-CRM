// Capacity band logic — pure, tested. Phase 07 / ADR-022.
//
// A day's load is committed job-hours (sum of estimated_hours for confirmed /
// in-progress jobs moving that day). Utilisation = load / daily-max drives a
// traffic-light band. An admin override forces a band regardless of load.
// The Supabase reads live in lib/queries/capacity.ts.

export const CAPACITY_BANDS = ['green', 'yellow', 'red', 'closed'] as const;
export type CapacityBand = (typeof CAPACITY_BANDS)[number];

export function isCapacityBand(value: string): value is CapacityBand {
  return (CAPACITY_BANDS as readonly string[]).includes(value);
}

// v1 daily capacity in job-hours. A module constant for now (ADR-022); moves to
// settings in a later increment. Picked so a typical full day trips yellow/red.
export const DEFAULT_DAILY_CAPACITY_HOURS = 48;

// Utilisation thresholds (share of daily-max).
export const YELLOW_AT = 0.6;
export const RED_AT = 0.9;

export function utilization(committedHours: number, maxHours: number): number {
  return maxHours > 0 ? committedHours / maxHours : 1;
}

export function deriveBand(committedHours: number, maxHours: number): CapacityBand {
  const u = utilization(committedHours, maxHours);
  if (u >= RED_AT) return 'red';
  if (u >= YELLOW_AT) return 'yellow';
  return 'green';
}

// An override (forced_band) always wins over the load-derived band.
export function effectiveBand(derived: CapacityBand, override: CapacityBand | null): CapacityBand {
  return override ?? derived;
}
