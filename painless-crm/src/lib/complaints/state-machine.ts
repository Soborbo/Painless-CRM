// Phase 11 §5 — complaints state machine. Pure + date-injectable so the SLA
// cron and the admin actions share one source of truth.
//
// Statuses (mirrors the SQL check on complaints.status):
//   new          — just submitted, awaiting first response
//   investigating — admin acknowledged and is working it
//   resolved     — closed out
//   escalated    — surfaced to a manager (not resolved within 7 days)
//
// First-response SLA is 24h from creation; escalation fires at 7 days unresolved.

export type ComplaintStatus = 'new' | 'investigating' | 'resolved' | 'escalated';
export type SeveritySelfAssessed = 'minor' | 'needs_fix' | 'major';
export type Severity = 'low' | 'medium' | 'high' | 'critical';

export const SLA_FIRST_RESPONSE_MS = 24 * 60 * 60 * 1000;
export const ESCALATION_MS = 7 * 24 * 60 * 60 * 1000;

const ALLOWED: Record<ComplaintStatus, ComplaintStatus[]> = {
  new: ['investigating', 'resolved', 'escalated'],
  investigating: ['resolved', 'escalated'],
  escalated: ['investigating', 'resolved'],
  resolved: [],
};

export function canTransition(from: ComplaintStatus, to: ComplaintStatus): boolean {
  return ALLOWED[from]?.includes(to) ?? false;
}

// Customer self-assessment never maps to `critical` — that's an internal call.
export function severityFromSelfAssessed(s: SeveritySelfAssessed): Severity {
  switch (s) {
    case 'minor':
      return 'low';
    case 'needs_fix':
      return 'medium';
    case 'major':
      return 'high';
  }
}

export function firstResponseDueAt(createdAt: Date): Date {
  return new Date(createdAt.getTime() + SLA_FIRST_RESPONSE_MS);
}

// A complaint escalates when it's still open (new/investigating) 7 days on.
export function isEscalationDue(createdAt: Date, status: ComplaintStatus, now: Date): boolean {
  if (status === 'resolved' || status === 'escalated') return false;
  return now.getTime() >= createdAt.getTime() + ESCALATION_MS;
}

export function isFirstResponseBreached(
  createdAt: Date,
  firstResponseAt: string | null,
  now: Date,
): boolean {
  if (firstResponseAt) return false;
  return now.getTime() >= createdAt.getTime() + SLA_FIRST_RESPONSE_MS;
}
