import {
  DEFAULT_GPS_CLOCK_IN_THRESHOLD_M,
  haversineMeters,
  isClockInFlagged,
} from '@/lib/worker/gps';
import { describe, expect, it } from 'vitest';

describe('haversineMeters', () => {
  it('is zero for identical points', () => {
    expect(haversineMeters(51.45, -2.58, 51.45, -2.58)).toBe(0);
  });

  it('approximates a known short distance (~1.11km per 0.01° latitude)', () => {
    const d = haversineMeters(51.45, -2.58, 51.46, -2.58);
    expect(d).toBeGreaterThan(1050);
    expect(d).toBeLessThan(1150);
  });

  it('is symmetric', () => {
    const a = haversineMeters(51.45, -2.58, 51.5, -2.6);
    const b = haversineMeters(51.5, -2.6, 51.45, -2.58);
    expect(Math.abs(a - b)).toBeLessThan(1e-6);
  });
});

describe('isClockInFlagged', () => {
  it('flags distances beyond the threshold', () => {
    expect(isClockInFlagged(600)).toBe(true);
    expect(isClockInFlagged(DEFAULT_GPS_CLOCK_IN_THRESHOLD_M)).toBe(false); // exactly at threshold
    expect(isClockInFlagged(499)).toBe(false);
  });
  it('honours a custom threshold', () => {
    expect(isClockInFlagged(600, 1000)).toBe(false);
    expect(isClockInFlagged(1200, 1000)).toBe(true);
  });
  it('never flags when distance is unknown', () => {
    expect(isClockInFlagged(null)).toBe(false);
    expect(isClockInFlagged(undefined)).toBe(false);
  });
});
