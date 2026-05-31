import { z } from 'zod';

// Calendar-day filter (matches an <input type="date"> value). Empty strings
// arriving from the URL collapse to undefined so an unset control is a no-op.
export const optionalDateFilter = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Expected YYYY-MM-DD' })
    .optional(),
);
