import { z } from 'zod';

// Phone-call entries — manual log v0.1 ("light Tamar" per Phase 06b §4).
// The schema mirrors the `phone_calls` Postgres table; the optional fields
// (notes, recording_url) stay optional because the Tamar Email/API sources
// will populate them later. `source` is locked to 'manual' here — webhook
// ingestion paths will set their own source string.

export const PHONE_CALL_DIRECTIONS = ['inbound', 'outbound'] as const;
export type PhoneCallDirection = (typeof PHONE_CALL_DIRECTIONS)[number];

const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v.length === 0 ? null : v))
    .nullable()
    .optional()
    .transform((v) => v ?? null);

export const LogPhoneCallSchema = z.object({
  job_id: z.string().uuid(),
  direction: z.enum(PHONE_CALL_DIRECTIONS),
  occurred_at: z.string().refine((v) => !Number.isNaN(Date.parse(v)), {
    message: 'Invalid timestamp',
  }),
  duration_seconds: z.coerce
    .number()
    .int()
    .min(0)
    .max(60 * 60 * 4),
  caller_number: optionalTrimmed(40),
  called_number: optionalTrimmed(40),
  notes: optionalTrimmed(2000),
});

export type LogPhoneCallInput = z.infer<typeof LogPhoneCallSchema>;
