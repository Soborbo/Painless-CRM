import { z } from 'zod';

// Phase 22 — appointment + staff-holiday validation (ADR-031).

const optionalUuid = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
  z.string().uuid().optional(),
);

const optionalText = (max: number) =>
  z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().trim().max(max).optional(),
  );

// <input type="datetime-local"> value, e.g. "2026-06-01T08:30". Treated as UTC
// (the whole app is UTC-stable); the action appends seconds + Z.
const datetimeLocal = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, { message: 'Enter a date and time' });

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Enter a date' });

export const APPOINTMENT_CATEGORIES = ['survey', 'move', 'callback', 'meeting', 'other'] as const;
export const HOLIDAY_KINDS = ['holiday', 'sick', 'training', 'other'] as const;

export const AppointmentSchema = z
  .object({
    title: z.string().trim().min(1, { message: 'Title is required' }).max(200),
    category: z.enum(APPOINTMENT_CATEGORIES),
    starts_at: datetimeLocal,
    ends_at: datetimeLocal,
    job_id: optionalUuid,
    customer_id: optionalUuid,
    assigned_to_id: optionalUuid,
    notes: optionalText(2000),
  })
  // Same-format strings compare correctly, so this orders the two instants.
  .refine((o) => o.ends_at > o.starts_at, {
    message: 'End must be after start',
    path: ['ends_at'],
  });

export type AppointmentInput = z.infer<typeof AppointmentSchema>;

export const StaffHolidaySchema = z
  .object({
    worker_id: z.string().uuid(),
    start_date: ymd,
    end_date: ymd,
    kind: z.enum(HOLIDAY_KINDS),
    notes: optionalText(2000),
  })
  .refine((o) => o.end_date >= o.start_date, {
    message: 'End cannot be before start',
    path: ['end_date'],
  });

export type StaffHolidayInput = z.infer<typeof StaffHolidaySchema>;

export const DeleteByIdSchema = z.object({ id: z.string().uuid() });

// "2026-06-01T08:30" → "2026-06-01T08:30:00.000Z"
export function datetimeLocalToIso(value: string): string {
  return `${value}:00.000Z`;
}
