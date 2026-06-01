import { z } from 'zod';

// Phase 12 §10 — record a manual payment against an invoice. Xero/GoCardless
// feed payments via webhooks later; this is the office "mark it paid" path.

export const PAYMENT_METHODS = [
  'bank_transfer',
  'card',
  'direct_debit',
  'cash',
  'cheque',
  'other',
] as const;

export const RecordPaymentSchema = z.object({
  invoice_id: z.string().uuid(),
  amount_pounds: z.coerce.number().positive('Enter an amount').max(1_000_000),
  method: z.enum(PAYMENT_METHODS),
  occurred_at: z
    .string()
    .trim()
    .min(1)
    .optional()
    .or(z.literal('').transform(() => undefined)),
  reference: z
    .string()
    .trim()
    .max(200)
    .optional()
    .or(z.literal('').transform(() => undefined)),
});

export type RecordPaymentInput = z.infer<typeof RecordPaymentSchema>;
