import {
  type CapacityBand,
  DEFAULT_DAILY_CAPACITY_HOURS,
  deriveBand,
  effectiveBand,
  isCapacityBand,
  utilization,
} from '@/lib/capacity/band';
import { type CapacityWindow, dateKey, enumerateDays } from '@/lib/capacity/calendar';
import { createClient } from '@/lib/supabase/server';

// Phase 07 capacity read. Sums committed job-hours per day (confirmed /
// in-progress jobs by move_date), folds in any admin overrides, and derives
// the traffic-light band per day across the window. RLS scopes both reads.

export interface DayCapacity {
  date: string; // YYYY-MM-DD
  committedHours: number;
  maxHours: number;
  utilizationPct: number;
  jobCount: number;
  derivedBand: CapacityBand;
  override: CapacityBand | null;
  band: CapacityBand;
}

const MAX_JOBS = 5000;

export interface JobHoursRow {
  move_date: string | null;
  estimated_hours: number | null;
}
export interface OverrideRow {
  date: string;
  forced_band: string | null;
}

// Pure assembly: committed hours + overrides → per-day bands across the window.
// Shared by the user-scoped read (getCapacityCalendar) and the cron recompute.
export function assembleCapacity(
  jobRows: readonly JobHoursRow[],
  overrideRows: readonly OverrideRow[],
  window: CapacityWindow,
  maxHours: number,
): DayCapacity[] {
  const committed = new Map<string, { hours: number; count: number }>();
  for (const row of jobRows) {
    if (!row.move_date) continue;
    const key = dateKey(row.move_date);
    const entry = committed.get(key) ?? { hours: 0, count: 0 };
    entry.hours += row.estimated_hours ?? 0;
    entry.count += 1;
    committed.set(key, entry);
  }

  const overrides = new Map<string, CapacityBand>();
  for (const row of overrideRows) {
    if (row.forced_band && isCapacityBand(row.forced_band))
      overrides.set(row.date, row.forced_band);
  }

  return enumerateDays(window).map((date) => {
    const c = committed.get(date) ?? { hours: 0, count: 0 };
    const derivedBand = deriveBand(c.hours, maxHours);
    const override = overrides.get(date) ?? null;
    return {
      date,
      committedHours: c.hours,
      maxHours,
      utilizationPct: Math.round(utilization(c.hours, maxHours) * 100),
      jobCount: c.count,
      derivedBand,
      override,
      band: effectiveBand(derivedBand, override),
    };
  });
}

export async function getCapacityCalendar(
  window: CapacityWindow,
  maxHours: number = DEFAULT_DAILY_CAPACITY_HOURS,
): Promise<DayCapacity[]> {
  const supabase = await createClient();

  const [{ data: jobRows }, { data: overrideRows }] = await Promise.all([
    supabase
      .from('jobs')
      .select('move_date, estimated_hours')
      .is('deleted_at', null)
      .in('stage', ['confirmed', 'in_progress'])
      .gte('move_date', window.startIso)
      .lt('move_date', window.endIso)
      .limit(MAX_JOBS),
    supabase
      .from('capacity_overrides')
      .select('date, forced_band')
      .gte('date', dateKey(window.startIso))
      .lt('date', dateKey(window.endIso)),
  ]);

  return assembleCapacity(
    (jobRows ?? []) as JobHoursRow[],
    (overrideRows ?? []) as OverrideRow[],
    window,
    maxHours,
  );
}

export interface ActiveOverride {
  date: string;
  forced_band: CapacityBand;
  reason: string;
}

export async function listActiveOverrides(window: CapacityWindow): Promise<ActiveOverride[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('capacity_overrides')
    .select('date, forced_band, reason')
    .gte('date', dateKey(window.startIso))
    .lt('date', dateKey(window.endIso))
    .order('date', { ascending: true });
  return (data ?? [])
    .filter((r): r is { date: string; forced_band: string; reason: string } =>
      isCapacityBand((r.forced_band as string | null) ?? ''),
    )
    .map((r) => ({ date: r.date, forced_band: r.forced_band as CapacityBand, reason: r.reason }));
}
