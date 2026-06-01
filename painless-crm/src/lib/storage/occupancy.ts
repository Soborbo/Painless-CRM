// Phase 08 §Storage — container occupancy. Pure: summarise a site's containers
// by status so the list + site pages render the same occupancy figures without
// duplicating the counting logic. Occupancy % counts only occupied containers
// against the total (reserved/maintenance are not "in use" by a customer yet).

export const CONTAINER_STATUSES = ['available', 'reserved', 'occupied', 'maintenance'] as const;
export type ContainerStatus = (typeof CONTAINER_STATUSES)[number];

export interface OccupancySummary {
  total: number;
  available: number;
  reserved: number;
  occupied: number;
  maintenance: number;
  occupancyPct: number; // occupied / total, rounded; 0 when no containers
}

export function isContainerStatus(value: unknown): value is ContainerStatus {
  return typeof value === 'string' && (CONTAINER_STATUSES as readonly string[]).includes(value);
}

export function summariseOccupancy(statuses: readonly (string | null)[]): OccupancySummary {
  const counts = { available: 0, reserved: 0, occupied: 0, maintenance: 0 };
  for (const status of statuses) {
    if (isContainerStatus(status)) counts[status] += 1;
  }
  const total = statuses.length;
  return {
    total,
    ...counts,
    occupancyPct: total === 0 ? 0 : Math.round((counts.occupied / total) * 100),
  };
}
