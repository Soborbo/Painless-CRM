import {
  allowedRentalTransitions,
  canReserveContainer,
  containerStatusForRental,
  isCurrentRental,
  isRentalStatus,
  isRentalTransitionAllowed,
} from '@/lib/storage/rental-lifecycle';
import { describe, expect, it } from 'vitest';

describe('isRentalStatus', () => {
  it('recognises the three rental statuses', () => {
    expect(isRentalStatus('pending')).toBe(true);
    expect(isRentalStatus('terminated')).toBe(true);
    expect(isRentalStatus('archived')).toBe(false);
    expect(isRentalStatus(null)).toBe(false);
  });
});

describe('containerStatusForRental', () => {
  it('maps rental status to the projected container status', () => {
    expect(containerStatusForRental('pending')).toBe('reserved');
    expect(containerStatusForRental('active')).toBe('occupied');
    expect(containerStatusForRental('terminated')).toBe('available');
  });
});

describe('canReserveContainer', () => {
  it('allows reserving only an available container', () => {
    expect(canReserveContainer('available')).toBe(true);
    expect(canReserveContainer('reserved')).toBe(false);
    expect(canReserveContainer('occupied')).toBe(false);
    expect(canReserveContainer('maintenance')).toBe(false);
  });
});

describe('rental transitions', () => {
  it('lists the allowed next states', () => {
    expect(allowedRentalTransitions('pending')).toEqual(['active', 'terminated']);
    expect(allowedRentalTransitions('active')).toEqual(['terminated']);
    expect(allowedRentalTransitions('terminated')).toEqual([]);
  });

  it('validates a single transition', () => {
    expect(isRentalTransitionAllowed('pending', 'active')).toBe(true);
    expect(isRentalTransitionAllowed('active', 'terminated')).toBe(true);
    expect(isRentalTransitionAllowed('active', 'pending')).toBe(false);
    expect(isRentalTransitionAllowed('terminated', 'active')).toBe(false);
  });
});

describe('isCurrentRental', () => {
  it('treats pending and active as current, terminated as history', () => {
    expect(isCurrentRental('pending')).toBe(true);
    expect(isCurrentRental('active')).toBe(true);
    expect(isCurrentRental('terminated')).toBe(false);
  });
});
