import { isContainerStatus, summariseOccupancy } from '@/lib/storage/occupancy';
import { describe, expect, it } from 'vitest';

describe('isContainerStatus', () => {
  it('accepts the four known statuses and rejects the rest', () => {
    expect(isContainerStatus('occupied')).toBe(true);
    expect(isContainerStatus('maintenance')).toBe(true);
    expect(isContainerStatus('sold')).toBe(false);
    expect(isContainerStatus(null)).toBe(false);
  });
});

describe('summariseOccupancy', () => {
  it('returns an all-zero summary for an empty site', () => {
    expect(summariseOccupancy([])).toEqual({
      total: 0,
      available: 0,
      reserved: 0,
      occupied: 0,
      maintenance: 0,
      occupancyPct: 0,
    });
  });

  it('counts each status and ignores unknown values', () => {
    const s = summariseOccupancy([
      'occupied',
      'occupied',
      'reserved',
      'available',
      'maintenance',
      null,
      'bogus',
    ]);
    expect(s.total).toBe(7);
    expect(s.occupied).toBe(2);
    expect(s.reserved).toBe(1);
    expect(s.available).toBe(1);
    expect(s.maintenance).toBe(1);
  });

  it('computes occupancy as occupied over total, rounded', () => {
    expect(summariseOccupancy(['occupied', 'available', 'available']).occupancyPct).toBe(33);
    expect(summariseOccupancy(['occupied', 'occupied']).occupancyPct).toBe(100);
    // reserved/maintenance do not count as occupied
    expect(summariseOccupancy(['reserved', 'maintenance']).occupancyPct).toBe(0);
  });
});
