// Phase 12 §10 — payment → invoice allocation maths. Pure + integer pence.
// A payment fills the invoice's outstanding balance; anything left over is held
// as customer credit (overpayment), never silently dropped.

import type { InvoiceStatus } from './status';

export interface PaymentSplit {
  applied_pence: number; // goes to payment_to_invoice
  overpayment_pence: number; // held as customer credit
}

export function splitPayment(paymentPence: number, outstandingPence: number): PaymentSplit {
  const applied = Math.min(paymentPence, Math.max(outstandingPence, 0));
  return { applied_pence: applied, overpayment_pence: paymentPence - applied };
}

// Payment-driven status. Time-based `overdue` is owned by the dunning cron, and
// a void invoice never changes here.
export function deriveInvoiceStatus(
  current: InvoiceStatus,
  totalPence: number,
  paidPence: number,
): InvoiceStatus {
  if (current === 'void') return 'void';
  if (totalPence > 0 && paidPence >= totalPence) return 'paid';
  if (paidPence > 0) return 'partial';
  return current === 'overdue' ? 'overdue' : 'sent';
}
