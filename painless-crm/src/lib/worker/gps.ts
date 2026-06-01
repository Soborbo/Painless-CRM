// Phase 09 §GPS verification. Pure: haversine distance between two lat/lng
// points and the clock-in flag rule. Used by the clock-in flow (a clock-in
// pressed more than the threshold from the job address is flagged) and testable
// without any browser geolocation.

const EARTH_RADIUS_M = 6_371_000;

export const DEFAULT_GPS_CLOCK_IN_THRESHOLD_M = 500;

const toRad = (deg: number) => (deg * Math.PI) / 180;

export function haversineMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

// A clock-in is flagged when the worker is further than the threshold from the
// job address. A missing distance (no GPS fix / no geocode) is NOT flagged —
// we can't claim they were away if we never measured.
export function isClockInFlagged(
  distanceM: number | null | undefined,
  thresholdM: number = DEFAULT_GPS_CLOCK_IN_THRESHOLD_M,
): boolean {
  if (distanceM === null || distanceM === undefined) return false;
  return distanceM > thresholdM;
}
