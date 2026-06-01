import { z } from 'zod';

// Phase 10 §2 — survey detail. The surveyor records the move's scope: type,
// schedule/completion, the cubic-ft estimate + confidence, complications, and
// the internal vs customer-facing notes. Video ingest + AI estimate are
// deferred (infra-gated), so source_video_url is just a pasted link for now.

const SURVEY_TYPES = ['video_self', 'video_live', 'in_person', 'estimate_only'] as const;
const CONFIDENCE = ['low', 'medium', 'high'] as const;

const optionalText = z
  .string()
  .trim()
  .max(8000)
  .optional()
  .or(z.literal('').transform(() => undefined));

const optionalCubic = z
  .union([z.literal(''), z.coerce.number().min(0).max(100_000)])
  .transform((v) => (v === '' ? undefined : v))
  .optional();

const optionalTimestamp = z
  .string()
  .trim()
  .min(1)
  .optional()
  .or(z.literal('').transform(() => undefined));

const optionalConfidence = z
  .enum(CONFIDENCE)
  .optional()
  .or(z.literal('').transform(() => undefined));

const optionalUrl = z
  .string()
  .trim()
  .url()
  .max(2000)
  .optional()
  .or(z.literal('').transform(() => undefined));

// `complications` is a free list of short codes/labels, entered one per line or
// comma-separated, stored as a jsonb string array.
function parseComplications(raw: FormDataEntryValue | null): string[] {
  if (typeof raw !== 'string') return [];
  return raw
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, 50);
}

export const SurveyCreateSchema = z.object({
  job_id: z.string().uuid(),
  survey_type: z.enum(SURVEY_TYPES),
  scheduled_at: optionalTimestamp,
  completed: z.coerce.boolean().optional().default(false),
  cubic_ft_estimate: optionalCubic,
  cubic_ft_confidence: optionalConfidence,
  notes_internal: optionalText,
  notes_for_customer: optionalText,
  source_video_url: optionalUrl,
});

export type SurveyCreateInput = z.infer<typeof SurveyCreateSchema>;

export const SurveyUpdateSchema = SurveyCreateSchema.omit({ job_id: true }).extend({
  id: z.string().uuid(),
  version: z.coerce.number().int().nonnegative(),
});

export type SurveyUpdateInput = z.infer<typeof SurveyUpdateSchema>;

export { SURVEY_TYPES, CONFIDENCE, parseComplications };
