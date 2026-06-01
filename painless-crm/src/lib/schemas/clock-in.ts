import { z } from 'zod';

// Phase 09 §clock-in. The worker app posts a clock-in with a client-generated
// UUID (idempotent replay) and an optional GPS fix. Times are client-recorded
// (when the worker pressed the button) so an offline-then-synced entry keeps its
// true timestamp.

const optionalCoord = z
  .union([z.literal(''), z.coerce.number()])
  .transform((v) => (v === '' ? null : v))
  .nullable()
  .optional()
  .transform((v) => v ?? null);

export const ClockInSchema = z.object({
  job_id: z.string().uuid('Invalid job'),
  client_event_id: z.string().uuid('Invalid event id'),
  gps_lat: optionalCoord,
  gps_lng: optionalCoord,
  gps_accuracy_m: optionalCoord,
  // ISO timestamp the client recorded; defaults to server time if absent/invalid.
  client_recorded_at: z
    .string()
    .datetime({ offset: true })
    .optional()
    .or(z.literal('').transform(() => undefined)),
});

export type ClockInInput = z.infer<typeof ClockInSchema>;
