import {
  type CalendarAppointment,
  type CalendarHoliday,
  appointmentsOverlap,
  chunkWeeks,
  groupAppointmentsByDay,
  holidayCoversDate,
  sameMonth,
  startOfWeek,
  viewDays,
  workersOnHoliday,
} from '@/lib/calendar/grid';
import { describe, expect, it } from 'vitest';

function appt(over: Partial<CalendarAppointment>): CalendarAppointment {
  return {
    id: 'a',
    title: 'T',
    category: 'survey',
    starts_at: '2026-06-10T09:00:00.000Z',
    ends_at: '2026-06-10T10:00:00.000Z',
    job_id: null,
    customer_id: null,
    assigned_to_id: null,
    assigned_to_name: null,
    ...over,
  };
}

describe('startOfWeek', () => {
  it('returns the Monday of the week (UTC)', () => {
    expect(startOfWeek('2026-06-10')).toBe('2026-06-08'); // Wed → Mon
    expect(startOfWeek('2026-06-08')).toBe('2026-06-08'); // Mon → itself
    expect(startOfWeek('2026-06-14')).toBe('2026-06-08'); // Sun → Mon
  });
});

describe('viewDays', () => {
  it('day view is the single anchor', () => {
    expect(viewDays('day', '2026-06-10')).toEqual(['2026-06-10']);
  });
  it('week view is Mon–Sun, 7 days', () => {
    const w = viewDays('week', '2026-06-10');
    expect(w).toHaveLength(7);
    expect(w[0]).toBe('2026-06-08');
    expect(w[6]).toBe('2026-06-14');
  });
  it('month view is whole weeks covering the month, Monday-aligned', () => {
    const days = viewDays('month', '2026-06-15');
    expect(days.length % 7).toBe(0);
    const first = days[0] as string;
    const last = days[days.length - 1] as string;
    expect(startOfWeek(first)).toBe(first); // starts on a Monday
    expect(first <= '2026-06-01').toBe(true);
    expect(last >= '2026-06-30').toBe(true);
  });
});

describe('sameMonth + chunkWeeks', () => {
  it('flags days in the anchor month', () => {
    expect(sameMonth('2026-06-30', '2026-06-01')).toBe(true);
    expect(sameMonth('2026-07-01', '2026-06-01')).toBe(false);
  });
  it('chunks into rows of 7', () => {
    const weeks = chunkWeeks(viewDays('month', '2026-06-15'));
    expect(weeks.every((w) => w.length === 7)).toBe(true);
  });
});

describe('groupAppointmentsByDay', () => {
  it('keys by start day and sorts within a day', () => {
    const map = groupAppointmentsByDay([
      appt({ id: 'late', starts_at: '2026-06-10T15:00:00.000Z' }),
      appt({ id: 'early', starts_at: '2026-06-10T08:00:00.000Z' }),
      appt({ id: 'other', starts_at: '2026-06-11T09:00:00.000Z' }),
    ]);
    expect(map.get('2026-06-10')?.map((a) => a.id)).toEqual(['early', 'late']);
    expect(map.get('2026-06-11')?.map((a) => a.id)).toEqual(['other']);
  });
});

describe('holiday helpers', () => {
  const h: CalendarHoliday = {
    id: 'h',
    worker_id: 'w1',
    worker_name: 'Sam',
    start_date: '2026-06-10',
    end_date: '2026-06-12',
    kind: 'holiday',
  };
  it('covers inclusive date range', () => {
    expect(holidayCoversDate(h, '2026-06-09')).toBe(false);
    expect(holidayCoversDate(h, '2026-06-10')).toBe(true);
    expect(holidayCoversDate(h, '2026-06-12')).toBe(true);
    expect(holidayCoversDate(h, '2026-06-13')).toBe(false);
  });
  it('lists workers off on a date', () => {
    expect(workersOnHoliday([h], '2026-06-11').map((x) => x.worker_id)).toEqual(['w1']);
    expect(workersOnHoliday([h], '2026-06-20')).toEqual([]);
  });
});

describe('appointmentsOverlap', () => {
  it('detects overlap and adjacency', () => {
    const a = appt({ starts_at: '2026-06-10T09:00:00.000Z', ends_at: '2026-06-10T10:00:00.000Z' });
    const overlapping = appt({
      starts_at: '2026-06-10T09:30:00.000Z',
      ends_at: '2026-06-10T10:30:00.000Z',
    });
    const adjacent = appt({
      starts_at: '2026-06-10T10:00:00.000Z',
      ends_at: '2026-06-10T11:00:00.000Z',
    });
    expect(appointmentsOverlap(a, overlapping)).toBe(true);
    expect(appointmentsOverlap(a, adjacent)).toBe(false); // touching, not overlapping
  });
});
