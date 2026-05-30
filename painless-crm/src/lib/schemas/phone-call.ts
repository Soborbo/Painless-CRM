import { z } from 'zod';

// Phone-call entries — manual log v0.1 ("light Tamar" per Phase 06b §4).
// The schema mirrors the `phone_calls` Postgres table; the optional fields
// (notes, recording_url) stay optional because the Tamar Email/API sources
// will populate them later. `source` is locked to 'manual' here — webhook
// ingestion paths will set their own source string.

export const PHONE_CALL_DIRECTIONS = ['inbound', 'outbound'] as const;
export type PhoneCallDirection = (typeof PHONE_CALL_DIRECTIONS)[number];

// §4 outcome taxonomy. The DB column is plain text (a future Tamar source may
// add values); this enum is the source of truth for the manual log.
export const PHONE_CALL_OUTCOMES = [
  'connected_quote_sent',
  'connected_no_answer',
  'voicemail_left',
  'wrong_number',
  'not_interested',
  'callback_requested',
] as const;
export type PhoneCallOutcome = (typeof PHONE_CALL_OUTCOMES)[number];

const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v.length === 0 ? null : v))
    .nullable()
    .optional()
    .transform((v) => v ?? null);

const emptyToNull = (v: unknown) => (v === '' || v === undefined ? null : v);

// Optional ISO timestamp: empty form field → null, otherwise must parse.
const optionalTimestamp = z.preprocess(
  emptyToNull,
  z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), { message: 'Invalid timestamp' })
    .nullable(),
);

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
  outcome: z.preprocess(emptyToNull, z.enum(PHONE_CALL_OUTCOMES).nullable()),
  next_action: optionalTrimmed(500),
  next_action_due_at: optionalTimestamp,
  notes: optionalTrimmed(2000),
});

export type LogPhoneCallInput = z.infer<typeof LogPhoneCallSchema>;
