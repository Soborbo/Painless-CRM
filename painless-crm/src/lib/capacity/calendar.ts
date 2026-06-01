// Pure calendar-window helpers for the capacity view. Phase 07.
// Everything is computed in UTC against an injected `now` so it stays
// deterministic and unit-testable (no ambient Date.now()).

export interface CapacityWindow {
  startIso: string;
  endIso: string;
}

export const CAPACITY_WEEKS = 6;

function startOfWeekUtc(now: Date): Date {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const isoDow = (d.getUTCDay() + 6) % 7; // 0 = Monday
  d.setUTCDate(d.getUTCDate() - isoDow);
  return d;
}

// The window starts on the Monday of the current week and spans `weeks` weeks
// (end exclusive) — the next-6-weeks traffic-light grid.
export function capacityWindow(now: Date, weeks: number = CAPACITY_WEEKS): CapacityWindow {
  const start = startOfWeekUtc(now);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + weeks * 7);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

// 'YYYY-MM-DD' for an ISO timestamp or date string (UTC day).
export function dateKey(iso: string): string {
  return iso.slice(0, 10);
}

export function enumerateDays(window: CapacityWindow): string[] {
  const days: string[] = [];
  const cursor = new Date(window.startIso);
  const end = new Date(window.endIso);
  while (cursor < end) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

export function chunkIntoWeeks(days: readonly string[]): string[][] {
  const weeks: string[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return weeks;
}
