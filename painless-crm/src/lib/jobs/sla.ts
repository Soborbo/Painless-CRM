// SLA badge logic for the lead funnel.
// Inputs come from jobs.first_response_due_at + jobs.first_response_at.
// Phase 16 will surface SLA breaches in the dashboard; Phase 04 just paints
// the badge on cards and rows.

export type SLAStatus = 'on_track' | 'warn' | 'breach' | 'cleared' | 'not_applicable';

export const WARN_FRACTION_REMAINING = 0.25;

export function computeSLAStatus(input: {
  firstResponseDueAt: string | null;
  firstResponseAt: string | null;
  enquiryAt: string | null;
  now?: Date;
}): SLAStatus {
  if (input.firstResponseAt) return 'cleared';
  if (!input.firstResponseDueAt) return 'not_applicable';

  const now = input.now ?? new Date();
  const due = new Date(input.firstResponseDueAt);
  if (Number.isNaN(due.getTime())) return 'not_applicable';

  if (due.getTime() <= now.getTime()) return 'breach';

  const enquiry = input.enquiryAt ? new Date(input.enquiryAt) : null;
  const window =
    enquiry && !Number.isNaN(enquiry.getTime()) ? due.getTime() - enquiry.getTime() : null;
  const remaining = due.getTime() - now.getTime();

  if (window && remaining <= window * WARN_FRACTION_REMAINING) return 'warn';
  return 'on_track';
}
