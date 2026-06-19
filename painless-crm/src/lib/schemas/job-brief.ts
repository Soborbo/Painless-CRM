import { BRIEF_ITEM_KINDS } from '@/lib/calendar/brief';
import { z } from 'zod';

// Phase 28 — validation for the structured move-brief editors (ADR-045): the
// kit / "not going" lists (job_brief_items) and the per-item reassembly toggle
// on cubic_sheet_items.

const ITEM_MAX = 200;
const NOTES_MAX = 1000;

const emptyToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);

// Checkboxes post 'on' when ticked and nothing when cleared.
const CHECKBOX = z
  .union([
    z.literal('on'),
    z.literal('true'),
    z.literal('false'),
    z.literal('off'),
    z.boolean(),
    z.null(),
  ])
  .optional()
  .transform((v) => v === 'on' || v === 'true' || v === true);

export const CreateBriefItemSchema = z.object({
  job_id: z.string().uuid(),
  kind: z.enum(BRIEF_ITEM_KINDS),
  item: z.string().trim().min(1, 'Item cannot be empty').max(ITEM_MAX),
  quantity: z.coerce.number().int().min(1).max(9999).default(1),
  notes: z.preprocess(emptyToUndefined, z.string().max(NOTES_MAX).optional()),
});
export type CreateBriefItemInput = z.infer<typeof CreateBriefItemSchema>;

export const UpdateBriefItemSchema = z.object({
  id: z.string().uuid(),
  item: z.string().trim().min(1).max(ITEM_MAX).optional(),
  quantity: z.coerce.number().int().min(1).max(9999).optional(),
  notes: z.preprocess(emptyToUndefined, z.string().max(NOTES_MAX).optional()),
});
export type UpdateBriefItemInput = z.infer<typeof UpdateBriefItemSchema>;

export const DeleteBriefItemSchema = z.object({ id: z.string().uuid() });

export const SetReassemblySchema = z.object({
  id: z.string().uuid(), // cubic_sheet_items.id
  reassembly_required: CHECKBOX,
});
export type SetReassemblyInput = z.infer<typeof SetReassemblySchema>;
