import { z } from 'zod';

// Job notes — Phase 06b §9. The single source of truth for visibility is
// `is_customer_visible`; the legacy `category` column on the table is set
// to 'admin' for new internal notes and 'customer_visible' for visible ones
// so direct SQL clients without the boolean still see something coherent.
//
// Body limit kept generous (8k chars) — these are operational scribbles, not
// formal communications. Cap is here mostly to keep RLS-checked rows small.

const NOTE_BODY_MAX = 8000;

export const AddJobNoteSchema = z.object({
  job_id: z.string().uuid(),
  body: z.string().trim().min(1, 'Note cannot be empty').max(NOTE_BODY_MAX),
  is_customer_visible: z
    .union([z.literal('on'), z.literal('true'), z.literal('false'), z.literal('off'), z.null()])
    .optional()
    .transform((v) => v === 'on' || v === 'true'),
});

export type AddJobNoteInput = z.infer<typeof AddJobNoteSchema>;

export const SoftDeleteNoteSchema = z.object({
  id: z.string().uuid(),
  job_id: z.string().uuid(),
});
