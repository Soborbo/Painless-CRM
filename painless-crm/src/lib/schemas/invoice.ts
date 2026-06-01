import { z } from 'zod';

// Phase 12 — invoice + line schemas. Money entered in £, converted to pence by
// the action. v0.2 buildable types only (deposit/custom/final/credit_note);
// storage_recurring/storage_initial arrive with GoCardless (deferred).

export const INVOICE_TYPES = ['deposit', 'custom', 'final', 'credit_note'] as const;

export const InvoiceCreateSchema = z.object({
  customer_id: z.string().uuid('Pick a customer'),
  job_id: z
    .string()
    .uuid()
    .optional()
    .or(z.literal('').transform(() => undefined)),
  type: z.enum(INVOICE_TYPES),
  due_at: z
    .string()
    .trim()
    .min(1)
    .optional()
    .or(z.literal('').transform(() => undefined)),
});

export type InvoiceCreateInput = z.infer<typeof InvoiceCreateSchema>;

export const InvoiceLineSchema = z.object({
  invoice_id: z.string().uuid(),
  description: z.string().trim().min(1, 'Describe the line').max(500),
  quantity: z.coerce.number().positive().max(100_000).default(1),
  unit_price_pounds: z.coerce.number().min(0).max(1_000_000),
  vat_rate: z.coerce.number().min(0).max(100).default(20),
});

export type InvoiceLineInput = z.infer<typeof InvoiceLineSchema>;

export const InvoiceStatusSchema = z.object({
  id: z.string().uuid(),
  version: z.coerce.number().int().nonnegative(),
  status: z.enum(['draft', 'sent', 'partial', 'paid', 'overdue', 'void']),
});

export type InvoiceStatusInput = z.infer<typeof InvoiceStatusSchema>;
