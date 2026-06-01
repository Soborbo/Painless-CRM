import { z } from 'zod';

// Phase 11 §1 — end-of-job customer sign-off, captured on the worker's phone.
// Customer signature (finger-drawn canvas → PNG data URL), an internal-only
// 1–5 satisfaction rating (never sent externally, never gates anything — see
// ADR-010), any verbal feedback to capture, and a confirmation that the
// customer wants the post-job follow-up email. Final cubic/hours live on the
// job_sheet (Phase 09). Carries the client UUID for idempotent offline replay.

// A finger-drawn signature PNG can be ~tens of KB; cap generously to bound the
// row. Must be an inline image data URL (never a remote/javascript URL).
const signatureDataUrl = z
  .string()
  .min(1, 'Signature is required')
  .max(2_000_000, 'Signature is too large')
  .refine((v) => /^data:image\/(png|jpeg);base64,/.test(v), 'Invalid signature image');

const optionalText = z
  .string()
  .trim()
  .max(4000)
  .optional()
  .or(z.literal('').transform(() => undefined));

const optionalLatLng = z
  .union([z.literal(''), z.coerce.number().min(-180).max(180)])
  .transform((v) => (v === '' ? null : v))
  .nullable()
  .optional()
  .transform((v) => v ?? null);

export const SignoffSchema = z.object({
  job_id: z.string().uuid('Invalid job'),
  client_event_id: z.string().uuid('Invalid event id'),
  signature_data_url: signatureDataUrl,
  // Internal-only satisfaction note, 1–5 (optional). Operations use only.
  internal_rating_1_5: z
    .union([z.literal(''), z.coerce.number().int().min(1).max(5)])
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  feedback_text: optionalText,
  // Customer confirmed the email we hold is right for the follow-up message.
  email_confirmed: z.coerce.boolean().optional().default(false),
  device_lat: optionalLatLng,
  device_lng: optionalLatLng,
  client_recorded_at: z
    .string()
    .datetime({ offset: true })
    .optional()
    .or(z.literal('').transform(() => undefined)),
});

export type SignoffInput = z.infer<typeof SignoffSchema>;
