import { DEFAULT_DAILY_CAPACITY_HOURS } from '@/lib/capacity/band';
import { capacityWindow } from '@/lib/capacity/calendar';
import { assembleCapacity } from '@/lib/queries/capacity';
import { describe, expect, it } from 'vitest';

const MAX = DEFAULT_DAILY_CAPACITY_HOURS; // 48
// 2026-06-01 is a Monday → window is 2026-06-01 .. 2026-07-13 (exclusive).
const WINDOW = capacityWindow(new Date('2026-06-01T12:00:00Z'));

describe('assembleCapacity', () => {
  it('sums committed hours per day and derives the band', () => {
    const days = assembleCapacity(
      [
        { move_date: '2026-06-15T09:00:00Z', estimated_hours: 30 },
        { move_date: '2026-06-15T13:00:00Z', estimated_hours: 16 }, // total 46 → 96% → red
        { move_date: '2026-06-16T09:00:00Z', estimated_hours: 30 }, // 62% → yellow
      ],
      [],
      WINDOW,
      MAX,
    );
    const d15 = days.find((d) => d.date === '2026-06-15');
    const d16 = days.find((d) => d.date === '2026-06-16');
    expect(d15).toMatchObject({ committedHours: 46, jobCount: 2, band: 'red' });
    expect(d16).toMatchObject({ committedHours: 30, jobCount: 1, band: 'yellow' });
  });

  it('lets an override win over the derived band', () => {
    const days = assembleCapacity(
      [{ move_date: '2026-06-15T09:00:00Z', estimated_hours: 46 }], // would be red
      [{ date: '2026-06-15', forced_band: 'green' }],
      WINDOW,
      MAX,
    );
    const d15 = days.find((d) => d.date === '2026-06-15');
    expect(d15?.derivedBand).toBe('red');
    expect(d15?.override).toBe('green');
    expect(d15?.band).toBe('green');
  });

  it('ignores an unknown forced_band', () => {
    const days = assembleCapacity([], [{ date: '2026-06-15', forced_band: 'teal' }], WINDOW, MAX);
    expect(days.find((d) => d.date === '2026-06-15')?.override).toBeNull();
  });

  it('emits every day in the window, defaulting empty days to green/0', () => {
    const days = assembleCapacity([], [], WINDOW, MAX);
    expect(days).toHaveLength(42);
    expect(days.every((d) => d.band === 'green' && d.committedHours === 0)).toBe(true);
  });

  it('skips rows with a null move_date', () => {
    const days = assembleCapacity([{ move_date: null, estimated_hours: 100 }], [], WINDOW, MAX);
    expect(days.every((d) => d.committedHours === 0)).toBe(true);
  });
});
