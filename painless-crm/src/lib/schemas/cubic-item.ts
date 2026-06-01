import { z } from 'zod';

// Phase 10 §3 — a single cubic-sheet line item. cubic_ft_total is a generated
// column, so it's never sent. Room is free-text (the UI offers common rooms).

const optionalText = z
  .string()
  .trim()
  .max(500)
  .optional()
  .or(z.literal('').transform(() => undefined));

export const CubicItemSchema = z.object({
  survey_id: z.string().uuid(),
  room: optionalText,
  item: z.string().trim().min(1, 'Name the item').max(200),
  quantity: z.coerce.number().int().min(1).max(9999).default(1),
  cubic_ft_each: z.coerce.number().min(0).max(100_000),
  fragile: z.coerce.boolean().optional().default(false),
  dismantle_required: z.coerce.boolean().optional().default(false),
  notes: optionalText,
});

export type CubicItemInput = z.infer<typeof CubicItemSchema>;
