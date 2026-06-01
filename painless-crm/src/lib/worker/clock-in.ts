import {
  DEFAULT_GPS_CLOCK_IN_THRESHOLD_M,
  haversineMeters,
  isClockInFlagged,
} from '@/lib/worker/gps';

// Phase 09 §clock-in. Pure: combine the worker's GPS fix with the job address to
// decide the recorded distance and whether the clock-in is flagged (too far from
// site). Either coordinate pair missing → no distance, not flagged (we can't
// claim they were away if we couldn't measure). Tested without geolocation.

export interface ClockInGeoInput {
  gpsLat: number | null;
  gpsLng: number | null;
  jobLat: number | null;
  jobLng: number | null;
  thresholdM?: number;
}

export interface ClockInGeoResult {
  distanceM: number | null;
  flagged: boolean;
}

export function computeClockInGeo({
  gpsLat,
  gpsLng,
  jobLat,
  jobLng,
  thresholdM = DEFAULT_GPS_CLOCK_IN_THRESHOLD_M,
}: ClockInGeoInput): ClockInGeoResult {
  if (gpsLat === null || gpsLng === null || jobLat === null || jobLng === null) {
    return { distanceM: null, flagged: false };
  }
  const distanceM = Math.round(haversineMeters(gpsLat, gpsLng, jobLat, jobLng));
  return { distanceM, flagged: isClockInFlagged(distanceM, thresholdM) };
}
