import { dateKey } from '@/lib/capacity/calendar';
import { addDaysYmd } from '@/lib/rota/dates';

// Phase 22 — pure calendar helpers for the appointments diary. UTC-stable and
// no I/O, so they unit-test directly. See ADR-031.

export type CalendarView = 'month' | 'week' | 'day';
export const CALENDAR_VIEWS = ['month', 'week', 'day'] as const;

export interface CalendarAppointment {
  id: string;
  title: string;
  category: string;
  starts_at: string; // ISO timestamp
  ends_at: string; // ISO timestamp
  job_id: string | null;
  customer_id: string | null;
  assigned_to_id: string | null;
  assigned_to_name: string | null;
}

export interface CalendarHoliday {
  id: string;
  worker_id: string;
  worker_name: string;
  start_date: string; // YYYY-MM-DD inclusive
  end_date: string; // YYYY-MM-DD inclusive
  kind: string;
}

// 0 = Monday … 6 = Sunday for a YYYY-MM-DD (UTC).
function isoDow(ymd: string): number {
  return (new Date(`${ymd}T00:00:00.000Z`).getUTCDay() + 6) % 7;
}

export function startOfWeek(ymd: string): string {
  return addDaysYmd(ymd, -isoDow(ymd));
}

export function sameMonth(ymd: string, anchorYmd: string): boolean {
  return ymd.slice(0, 7) === anchorYmd.slice(0, 7);
}

// The ordered list of day keys a view spans: a single day, the Mon–Sun week, or
// the full weeks covering the anchor's month (Monday-aligned, end-padded).
export function viewDays(view: CalendarView, anchorYmd: string): string[] {
  if (view === 'day') return [anchorYmd];
  if (view === 'week') {
    const start = startOfWeek(anchorYmd);
    return Array.from({ length: 7 }, (_, i) => addDaysYmd(start, i));
  }
  const [y, m] = anchorYmd.split('-').map(Number) as [number, number];
  const first = `${anchorYmd.slice(0, 7)}-01`;
  const lastDate = new Date(Date.UTC(y, m, 0)); // day 0 of next month = last of this
  const last = lastDate.toISOString().slice(0, 10);
  const gridStart = startOfWeek(first);
  const gridEnd = addDaysYmd(startOfWeek(last), 6);
  const days: string[] = [];
  for (let cur = gridStart; cur <= gridEnd; cur = addDaysYmd(cur, 1)) days.push(cur);
  return days;
}

export function chunkWeeks(days: readonly string[]): string[][] {
  const weeks: string[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return weeks;
}

// Appointments keyed by their start day, each cell sorted chronologically.
export function groupAppointmentsByDay(
  appts: readonly CalendarAppointment[],
): Map<string, CalendarAppointment[]> {
  const map = new Map<string, CalendarAppointment[]>();
  for (const a of appts) {
    const key = dateKey(a.starts_at);
    const list = map.get(key) ?? [];
    list.push(a);
    map.set(key, list);
  }
  for (const list of map.values()) list.sort((x, y) => x.starts_at.localeCompare(y.starts_at));
  return map;
}

export function holidayCoversDate(h: CalendarHoliday, ymd: string): boolean {
  return h.start_date <= ymd && ymd <= h.end_date;
}

export function workersOnHoliday(
  holidays: readonly CalendarHoliday[],
  ymd: string,
): CalendarHoliday[] {
  return holidays.filter((h) => holidayCoversDate(h, ymd));
}

// True when two appointments share any instant (half-open interval).
export function appointmentsOverlap(a: CalendarAppointment, b: CalendarAppointment): boolean {
  return a.starts_at < b.ends_at && b.starts_at < a.ends_at;
}
