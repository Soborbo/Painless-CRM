// ISO-8601 week helpers for the availability KV broadcast. Pure + UTC so the
// keys (availability:{company}:{YYYY-Www}) match what painlessremovals reads.
// See references/kv-broadcast.md.

import type { CapacityBand } from '@/lib/capacity/band';

// ISO week number + week-year for a 'YYYY-MM-DD' day (UTC).
export function isoWeekParts(dateKey: string): { year: number; week: number } {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
  // Shift to the Thursday of this week — ISO weeks are Thursday-anchored.
  const dayNum = (date.getUTCDay() + 6) % 7; // Mon = 0
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const weekYear = date.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(weekYear, 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const week = 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000));
  return { year: weekYear, week };
}

// 'YYYY-Www' key, e.g. '2026-W19'.
export function isoWeekKey(dateKey: string): string {
  const { year, week } = isoWeekParts(dateKey);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

export interface AvailabilityWeek {
  week: string; // YYYY-Www
  days: Record<string, CapacityBand>; // 'YYYY-MM-DD' → band
}

// Group day→band entries into ISO weeks, preserving day order. Weeks come out
// in ascending week order (input is assumed chronological, as the calendar is).
export function groupBandsByIsoWeek(
  days: readonly { date: string; band: CapacityBand }[],
): AvailabilityWeek[] {
  const order: string[] = [];
  const byWeek = new Map<string, Record<string, CapacityBand>>();
  for (const d of days) {
    const key = isoWeekKey(d.date);
    let bucket = byWeek.get(key);
    if (!bucket) {
      bucket = {};
      byWeek.set(key, bucket);
      order.push(key);
    }
    bucket[d.date] = d.band;
  }
  return order.map((week) => ({ week, days: byWeek.get(week) ?? {} }));
}
