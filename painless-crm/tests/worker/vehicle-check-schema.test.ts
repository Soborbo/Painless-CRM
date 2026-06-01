import { VehicleCheckSchema } from '@/lib/schemas/vehicle-check';
import { describe, expect, it } from 'vitest';

const base = {
  job_id: '11111111-1111-1111-1111-111111111111',
  vehicle_id: '22222222-2222-2222-2222-222222222222',
  client_event_id: '33333333-3333-3333-3333-333333333333',
  date: '2026-06-10',
};

describe('VehicleCheckSchema', () => {
  it('accepts a clean walk-around with coerced numbers', () => {
    const r = VehicleCheckSchema.safeParse({
      ...base,
      walk_around_clear: 'true',
      fuel_level: '75',
      mileage: '120350',
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.fuel_level).toBe(75);
      expect(r.data.mileage).toBe(120350);
      expect(r.data.walk_around_clear).toBe(true);
    }
  });

  it('treats blank fuel/mileage as null', () => {
    const r = VehicleCheckSchema.safeParse({
      ...base,
      walk_around_clear: 'true',
      fuel_level: '',
      mileage: '',
    });
    expect(r.success && r.data.fuel_level).toBeNull();
    expect(r.success && r.data.mileage).toBeNull();
  });

  it('rejects fuel outside 0–100', () => {
    expect(
      VehicleCheckSchema.safeParse({ ...base, walk_around_clear: 'true', fuel_level: '120' })
        .success,
    ).toBe(false);
  });

  it('requires defects when the walk-around is not clear', () => {
    expect(VehicleCheckSchema.safeParse({ ...base, walk_around_clear: 'false' }).success).toBe(
      false,
    );
    expect(
      VehicleCheckSchema.safeParse({
        ...base,
        walk_around_clear: 'false',
        defects_noted: 'Nearside tyre low',
      }).success,
    ).toBe(true);
  });
});
