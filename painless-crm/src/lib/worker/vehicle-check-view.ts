// Phase 09 — pure presentation logic for the vehicle-check admin view. Date/IO
// free so it's unit tested; the query supplies rows, this flags the ones an
// office manager should look at (defects, failed walk-around, or low fuel).

export const LOW_FUEL_THRESHOLD = 25;

export interface VehicleCheckLike {
  walk_around_clear: boolean | null;
  defects_noted: string | null;
  fuel_level: number | null;
}

export interface VehicleCheckFlags {
  hasDefects: boolean;
  failedWalkAround: boolean;
  lowFuel: boolean;
  needsAttention: boolean;
}

export function vehicleCheckFlags(check: VehicleCheckLike): VehicleCheckFlags {
  const hasDefects =
    typeof check.defects_noted === 'string' && check.defects_noted.trim().length > 0;
  // walk_around_clear === false is an explicit fail; null (not recorded) is not.
  const failedWalkAround = check.walk_around_clear === false;
  const lowFuel =
    typeof check.fuel_level === 'number' &&
    check.fuel_level >= 0 &&
    check.fuel_level < LOW_FUEL_THRESHOLD;
  return {
    hasDefects,
    failedWalkAround,
    lowFuel,
    needsAttention: hasDefects || failedWalkAround || lowFuel,
  };
}

// How many of a batch of checks need office attention — drives the page badge.
export function countNeedingAttention(checks: VehicleCheckLike[]): number {
  return checks.reduce((n, c) => n + (vehicleCheckFlags(c).needsAttention ? 1 : 0), 0);
}
