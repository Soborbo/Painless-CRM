import {
  AppointmentSchema,
  StaffHolidaySchema,
  datetimeLocalToIso,
} from '@/lib/schemas/appointment';
import { describe, expect, it } from 'vitest';

const APPT = {
  title: 'Survey at 14 Elm St',
  category: 'survey',
  starts_at: '2026-06-10T09:00',
  ends_at: '2026-06-10T10:00',
};

describe('AppointmentSchema', () => {
  it('accepts a valid appointment and treats blank links as undefined', () => {
    const r = AppointmentSchema.safeParse({ ...APPT, job_id: '', customer_id: '', notes: '' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.job_id).toBeUndefined();
  });

  it('rejects end before/equal to start', () => {
    expect(AppointmentSchema.safeParse({ ...APPT, ends_at: '2026-06-10T09:00' }).success).toBe(
      false,
    );
    expect(AppointmentSchema.safeParse({ ...APPT, ends_at: '2026-06-10T08:00' }).success).toBe(
      false,
    );
  });

  it('rejects a bad category or malformed datetime', () => {
    expect(AppointmentSchema.safeParse({ ...APPT, category: 'party' }).success).toBe(false);
    expect(AppointmentSchema.safeParse({ ...APPT, starts_at: '2026-06-10' }).success).toBe(false);
  });

  it('validates an optional assignee uuid', () => {
    expect(AppointmentSchema.safeParse({ ...APPT, assigned_to_id: 'nope' }).success).toBe(false);
  });
});

describe('StaffHolidaySchema', () => {
  const base = {
    worker_id: '11111111-1111-4111-8111-111111111111',
    start_date: '2026-06-10',
    end_date: '2026-06-12',
    kind: 'holiday',
  };
  it('accepts a valid holiday', () => {
    expect(StaffHolidaySchema.safeParse(base).success).toBe(true);
  });
  it('allows a single-day holiday (end == start)', () => {
    expect(StaffHolidaySchema.safeParse({ ...base, end_date: base.start_date }).success).toBe(true);
  });
  it('rejects end before start and unknown kind', () => {
    expect(StaffHolidaySchema.safeParse({ ...base, end_date: '2026-06-09' }).success).toBe(false);
    expect(StaffHolidaySchema.safeParse({ ...base, kind: 'sabbatical' }).success).toBe(false);
  });
});

describe('datetimeLocalToIso', () => {
  it('appends seconds and UTC marker', () => {
    expect(datetimeLocalToIso('2026-06-10T09:30')).toBe('2026-06-10T09:30:00.000Z');
  });
});
