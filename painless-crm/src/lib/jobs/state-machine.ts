// Mirrors STATE_MACHINE.md sections 1, 2, and 3.
// Compliance test: tests/jobs/state-machine.test.ts.
// If you change this file, update STATE_MACHINE.md FIRST per CLAUDE.md rule 13.

export const JOB_STAGES = [
  'lead',
  'contacted',
  'survey_scheduled',
  'quoted',
  'accepted',
  'confirmed',
  'in_progress',
  'completed',
  'invoiced',
  'paid',
  'declined',
  'dead',
  'cancelled',
] as const;
export type JobStage = (typeof JOB_STAGES)[number];

export const TERMINAL_STAGES = ['paid', 'declined', 'dead', 'cancelled'] as const;

export const ALLOWED_FORWARD_TRANSITIONS: Record<JobStage, readonly JobStage[]> = {
  lead: ['contacted', 'declined', 'dead'],
  contacted: ['survey_scheduled', 'quoted', 'declined', 'dead'],
  survey_scheduled: ['quoted', 'declined', 'dead'],
  quoted: ['accepted', 'declined', 'dead'],
  accepted: ['confirmed', 'cancelled'],
  confirmed: ['in_progress', 'cancelled'],
  in_progress: ['completed'],
  completed: ['invoiced'],
  invoiced: ['paid'],
  paid: [],
  declined: [],
  dead: [],
  cancelled: [],
};

export const ALLOWED_BACKWARD_TRANSITIONS: Record<JobStage, readonly JobStage[]> = {
  lead: [],
  contacted: ['lead'],
  survey_scheduled: ['contacted'],
  quoted: ['contacted', 'survey_scheduled'],
  accepted: ['quoted'],
  confirmed: ['accepted'],
  in_progress: ['confirmed'],
  completed: ['in_progress'],
  invoiced: ['completed'],
  paid: [],
  declined: [],
  dead: [],
  cancelled: [],
};

export type RequiredField =
  | 'customer_id'
  | 'enquiry_at'
  | 'acquisition_source'
  | 'assigned_to_id'
  | 'survey_at'
  | 'surveyor_id'
  | 'quote_id'
  | 'quote_total_pence'
  | 'quote_acceptance_id'
  | 'move_date'
  | 'deposit_payment_id'
  | 'time_entry_clock_in'
  | 'customer_signoff_id'
  | 'final_invoice_id'
  | 'all_invoices_paid'
  | 'decline_reason'
  | 'cancellation_reason'
  | 'deposit_refund_decision';

export const REQUIRED_FIELDS_FOR_ENTRY: Record<JobStage, readonly RequiredField[]> = {
  lead: ['customer_id', 'enquiry_at', 'acquisition_source'],
  contacted: ['assigned_to_id'],
  survey_scheduled: ['survey_at', 'surveyor_id'],
  quoted: ['quote_id', 'quote_total_pence'],
  accepted: ['quote_acceptance_id', 'move_date'],
  confirmed: ['deposit_payment_id'],
  in_progress: ['time_entry_clock_in'],
  completed: ['customer_signoff_id'],
  invoiced: ['final_invoice_id'],
  paid: ['all_invoices_paid'],
  declined: ['decline_reason'],
  dead: [],
  cancelled: ['cancellation_reason', 'deposit_refund_decision'],
};

export type TransitionDirection = 'forward' | 'backward' | 'forbidden';

export function classifyTransition(from: JobStage, to: JobStage): TransitionDirection {
  if (from === to) return 'forbidden';
  if (ALLOWED_FORWARD_TRANSITIONS[from].includes(to)) return 'forward';
  if (ALLOWED_BACKWARD_TRANSITIONS[from].includes(to)) return 'backward';
  return 'forbidden';
}

export function isTerminal(stage: JobStage): boolean {
  return (TERMINAL_STAGES as readonly JobStage[]).includes(stage);
}

export function nextStages(from: JobStage): readonly JobStage[] {
  return [...ALLOWED_FORWARD_TRANSITIONS[from], ...ALLOWED_BACKWARD_TRANSITIONS[from]];
}
