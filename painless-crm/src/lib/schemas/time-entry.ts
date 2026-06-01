import { TIME_ENTRY_STEPS } from '@/lib/worker/time-entry-steps';
import { z } from 'zod';

// Phase 09 §time entries — a job-progress marker from the worker app (not
// clock-in, which has its own GPS schema/route). Carries the client UUID for
// idempotent offline replay.
export const TimeEntrySchema = z.object({
  job_id: z.string().uuid('Invalid job'),
  client_event_id: z.string().uuid('Invalid event id'),
  type: z.enum(TIME_ENTRY_STEPS),
  client_recorded_at: z
    .string()
    .datetime({ offset: true })
    .optional()
    .or(z.literal('').transform(() => undefined)),
});

export type TimeEntryInput = z.infer<typeof TimeEntrySchema>;
