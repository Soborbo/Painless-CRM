// Phase 12 — invoice status machine (manual transitions; Xero/GoCardless drive
// it automatically later). Pure so the action and any future webhook share it.
//
//   draft   — being prepared, editable
//   sent    — issued to the customer (stamps issued_at + email_sent_at later)
//   partial — part-paid (set by payment allocation)
//   paid    — settled in full
//   overdue — past due_at, unpaid
//   void    — cancelled / superseded by a credit note

export type InvoiceStatus = 'draft' | 'sent' | 'partial' | 'paid' | 'overdue' | 'void';

const ALLOWED: Record<InvoiceStatus, InvoiceStatus[]> = {
  draft: ['sent', 'void'],
  sent: ['paid', 'partial', 'overdue', 'void'],
  partial: ['paid', 'overdue', 'void'],
  overdue: ['paid', 'partial', 'void'],
  paid: ['void'],
  void: [],
};

export function canTransition(from: InvoiceStatus, to: InvoiceStatus): boolean {
  return ALLOWED[from]?.includes(to) ?? false;
}

// Lines can only be edited while the invoice is still a draft.
export function isEditable(status: InvoiceStatus): boolean {
  return status === 'draft';
}
