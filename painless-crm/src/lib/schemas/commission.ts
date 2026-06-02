import { z } from 'zod';

// Phase 16 §1 — admin commission ledger transitions. commission_records is an
// append-style ledger (no version column); transitions are guarded by the
// expected current status instead of optimistic concurrency.

export const COMMISSION_STATUSES = ['pending', 'approved', 'paid', 'cancelled'] as const;
export type CommissionStatus = (typeof COMMISSION_STATUSES)[number];

export const CommissionActionSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(['approve', 'pay', 'cancel']),
});
export type CommissionActionInput = z.infer<typeof CommissionActionSchema>;

// Allowed status moves per ledger action.
export const COMMISSION_TRANSITIONS: Record<
  CommissionActionInput['action'],
  { from: CommissionStatus[]; to: CommissionStatus }
> = {
  approve: { from: ['pending'], to: 'approved' },
  pay: { from: ['approved'], to: 'paid' },
  cancel: { from: ['pending', 'approved'], to: 'cancelled' },
};
