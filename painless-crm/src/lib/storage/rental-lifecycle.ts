import type { ContainerStatus } from '@/lib/storage/occupancy';

// Phase 08 §Storage — rental lifecycle state machine (ADR-023). Pure: the
// container `status` column is the materialised projection of its current
// rental, written by the rental actions. This module defines the allowed rental
// transitions and the rental→container-status mapping so the actions and the UI
// agree without duplicating the rules.

export const RENTAL_STATUSES = ['pending', 'active', 'terminated'] as const;
export type RentalStatus = (typeof RENTAL_STATUSES)[number];

export function isRentalStatus(value: unknown): value is RentalStatus {
  return typeof value === 'string' && (RENTAL_STATUSES as readonly string[]).includes(value);
}

// What a container's status becomes given the rental that owns it.
const CONTAINER_STATUS_FOR_RENTAL: Record<RentalStatus, ContainerStatus> = {
  pending: 'reserved',
  active: 'occupied',
  terminated: 'available',
};

export function containerStatusForRental(rental: RentalStatus): ContainerStatus {
  return CONTAINER_STATUS_FOR_RENTAL[rental];
}

// A new rental may only be opened against a container that is free. Occupied,
// reserved and maintenance containers are all blocked.
export function canReserveContainer(containerStatus: ContainerStatus): boolean {
  return containerStatus === 'available';
}

const TRANSITIONS: Record<RentalStatus, RentalStatus[]> = {
  pending: ['active', 'terminated'],
  active: ['terminated'],
  terminated: [],
};

export function allowedRentalTransitions(from: RentalStatus): RentalStatus[] {
  return TRANSITIONS[from];
}

export function isRentalTransitionAllowed(from: RentalStatus, to: RentalStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

// A rental is "current" (counts as the container's live occupant) while it is
// pending or active; terminated rentals are history.
export function isCurrentRental(status: RentalStatus): boolean {
  return status === 'pending' || status === 'active';
}
