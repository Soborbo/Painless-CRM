import { z } from 'zod';

// Validation surface for quote variants. The schema lives separately so the
// server action and the (future) detail page can share it. variant_label is
// short on purpose — these are emailable choice names ("Pickup only",
// "Full service"), not free-text proposals.

export const VariantLabelSchema = z.string().trim().min(1).max(80);
export const VariantDescriptionSchema = z.string().trim().max(500).optional();
export const VariantTotalPenceSchema = z.coerce.number().int().min(0).max(100_000_00);

export const AddVariantSchema = z.object({
  quote_id: z.string().uuid(),
  variant_label: VariantLabelSchema,
  total_pence: VariantTotalPenceSchema,
  description: VariantDescriptionSchema,
  display_order: z.coerce.number().int().min(0).max(99).optional().default(0),
});

export const RemoveVariantSchema = z.object({
  variant_id: z.string().uuid(),
  quote_id: z.string().uuid(),
});

export type AddVariantInput = z.infer<typeof AddVariantSchema>;
