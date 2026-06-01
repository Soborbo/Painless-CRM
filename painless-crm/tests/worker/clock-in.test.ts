import { computeClockInGeo } from '@/lib/worker/clock-in';
import { describe, expect, it } from 'vitest';

describe('computeClockInGeo', () => {
  it('records distance and does not flag a clock-in at the site', () => {
    const r = computeClockInGeo({
      gpsLat: 51.4545,
      gpsLng: -2.5879,
      jobLat: 51.4546,
      jobLng: -2.588,
      thresholdM: 500,
    });
    expect(r.distanceM).not.toBeNull();
    expect(r.distanceM as number).toBeLessThan(500);
    expect(r.flagged).toBe(false);
  });

  it('flags a clock-in far from the site', () => {
    const r = computeClockInGeo({
      gpsLat: 51.4545,
      gpsLng: -2.5879,
      jobLat: 51.5,
      jobLng: -2.7,
      thresholdM: 500,
    });
    expect(r.flagged).toBe(true);
    expect(r.distanceM as number).toBeGreaterThan(500);
  });

  it('returns no distance and no flag when coordinates are missing', () => {
    expect(computeClockInGeo({ gpsLat: null, gpsLng: null, jobLat: 51.5, jobLng: -2.7 })).toEqual({
      distanceM: null,
      flagged: false,
    });
    expect(computeClockInGeo({ gpsLat: 51.5, gpsLng: -2.7, jobLat: null, jobLng: null })).toEqual({
      distanceM: null,
      flagged: false,
    });
  });
});
