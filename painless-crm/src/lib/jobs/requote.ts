import { computeFirstResponseDueAt } from '@/lib/jobs/sla-deadline';
import type { AcquisitionSource } from '@/lib/schemas/job';

// Builds the insert payload for a "requote" — a brand-new lead spun off
// from a finished job so the rep doesn't re-type the customer's size,
// hours, distance etc. The pure helper keeps the SQL-shaped side at the
// edge (Server Action) and the field-copying rules unit-testable.
//
// Phase 06b §6 / ADR (parent_job_id): only terminal jobs requote. We carry
// the estimating quantities forward so the new quote opens half-prefilled,
// but reset every workflow timestamp + the value field — the new job has
// its own SLA, its own pricing, its own quote.

export const REQUOTE_ELIGIBLE_STAGES = ['paid', 'declined', 'dead', 'cancelled'] as const;
export type RequoteEligibleStage = (typeof REQUOTE_ELIGIBLE_STAGES)[number];

export function isRequoteEligibleStage(stage: string): stage is RequoteEligibleStage {
  return (REQUOTE_ELIGIBLE_STAGES as readonly string[]).includes(stage);
}

export interface RequoteSource {
  id: string;
  company_id: string;
  customer_id: string;
  stage: string;
  acquisition_source: string | null;
  estimated_hours: number | null;
  estimated_cubic_ft: number | null;
  estimated_distance_miles: number | null;
}

export interface RequoteOverrides {
  moveDateIso: string | null;
  assignedToId: string | null;
  notes: string | null;
}

export interface RequoteInsert {
  company_id: string;
  job_number: string;
  customer_id: string;
  parent_job_id: string;
  stage: 'lead';
  acquisition_source: string;
  assigned_to_id: string | null;
  move_date: string | null;
  enquiry_at: string;
  first_response_due_at: string;
  estimated_hours: number | null;
  estimated_cubic_ft: number | null;
  estimated_distance_miles: number | null;
  notes: string | null;
  created_by_id: string;
  updated_by_id: string;
}

const DEFAULT_REQUOTE_SOURCE: AcquisitionSource = 'referral';

export function buildRequoteInsert(args: {
  source: RequoteSource;
  jobNumber: string;
  overrides: RequoteOverrides;
  actorId: string;
  now?: Date;
}): RequoteInsert {
  if (!isRequoteEligibleStage(args.source.stage)) {
    throw new Error(`Cannot requote a job in stage "${args.source.stage}"`);
  }

  const nowIso = (args.now ?? new Date()).toISOString();
  // Returning customers don't usually re-tick the original lead source —
  // treat them as referrals unless the rep already picked something on
  // the form (handled by the form layer, not here).
  const acquisitionSource = args.source.acquisition_source ?? DEFAULT_REQUOTE_SOURCE;

  return {
    company_id: args.source.company_id,
    job_number: args.jobNumber,
    customer_id: args.source.customer_id,
    parent_job_id: args.source.id,
    stage: 'lead',
    acquisition_source: acquisitionSource,
    assigned_to_id: args.overrides.assignedToId,
    move_date: args.overrides.moveDateIso,
    enquiry_at: nowIso,
    first_response_due_at: computeFirstResponseDueAt(nowIso, acquisitionSource),
    estimated_hours: args.source.estimated_hours,
    estimated_cubic_ft: args.source.estimated_cubic_ft,
    estimated_distance_miles: args.source.estimated_distance_miles,
    notes: args.overrides.notes,
    created_by_id: args.actorId,
    updated_by_id: args.actorId,
  };
}
