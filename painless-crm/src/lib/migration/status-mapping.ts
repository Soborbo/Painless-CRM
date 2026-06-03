// iMVE status → painless-crm (stage, sub_status, decline_reason) mapping.
// Mirrors MIGRATION_MAPPING.md §3 (CRITICAL). STATE_MACHINE.md is the source of truth
// for the target stage enum — see src/lib/jobs/state-machine.ts.
//
// Doctrine: unmapped statuses are NEVER silently defaulted to a stage. An unknown
// iMVE status throws UnmappedStatusError so the import halts and the gap is reviewed
// with Jay before go-live (MIGRATION_MAPPING.md §3 TODO).

import type { JobStage } from '@/lib/jobs/state-machine';

export type StorageStatus = 'active' | 'terminated';

export type MappedStatus = {
  stage: JobStage;
  sub_status: string | null;
  decline_reason: string | null;
  /** Set only for "Storage Active/Terminated" rows — the job stage is `paid` and a
   *  storage_rentals row carries this status. */
  storage_status: StorageStatus | null;
};

export class UnmappedStatusError extends Error {
  readonly rawStatus: string;
  constructor(rawStatus: string) {
    super(`Unmapped iMVE status: "${rawStatus}". Map it in status-mapping.ts before importing.`);
    this.name = 'UnmappedStatusError';
    this.rawStatus = rawStatus;
  }
}

function m(
  stage: JobStage,
  sub_status: string | null = null,
  decline_reason: string | null = null,
  storage_status: StorageStatus | null = null,
): MappedStatus {
  return { stage, sub_status, decline_reason, storage_status };
}

// Keys are normalized (see normalizeKey): lowercased, whitespace-collapsed, dashes unified.
const STATUS_TABLE: Record<string, MappedStatus> = {
  'new enquiry': m('lead'),
  'awaiting callback': m('contacted', 'awaiting_callback'),
  'callback done': m('contacted'),
  'survey booked': m('survey_scheduled'),
  'survey completed': m('survey_scheduled', 'completed'),
  'quote sent': m('quoted'),
  'quote sent - followup 1': m('quoted', 'followup_sent_1'),
  'quote sent - followup 2': m('quoted', 'followup_sent_2'),
  'awaiting video': m('quoted', 'awaiting_video'),
  'quote accepted': m('accepted'),
  'awaiting deposit': m('accepted', 'awaiting_deposit'),
  'job confirmed': m('confirmed'),
  'customer requesting reschedule': m('confirmed', 'reschedule_requested'),
  'job in progress': m('in_progress'),
  'job done': m('completed'),
  'job done - awaiting payment': m('invoiced'),
  paid: m('paid'),
  'lost - too expensive': m('declined', null, 'too_expensive'),
  'lost - chose competitor': m('declined', null, 'chose_competitor'),
  'lost - timing': m('declined', null, 'timing'),
  'lost - other': m('declined', null, 'other'),
  'lost - no response': m('dead'),
  'lost - cancelled': m('cancelled'),
  'lost - customer cancelled': m('cancelled', 'customer_cancelled'),
  'storage active': m('paid', null, null, 'active'),
  'storage terminated': m('paid', null, null, 'terminated'),
};

/** Normalize an iMVE status for lookup: trim, lowercase, collapse internal whitespace,
 *  and unify the various dash characters/spacing iMVE uses ("—", "-", " – ") to " - ". */
export function normalizeKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s*[–—-]\s*/g, ' - ')
    .replace(/\s+/g, ' ');
}

/** Map a raw iMVE status string to its canonical (stage, sub_status, decline_reason).
 *  Throws UnmappedStatusError on any status not in the table — no silent default. */
export function mapStatus(rawStatus: string): MappedStatus {
  const mapped = STATUS_TABLE[normalizeKey(rawStatus)];
  if (!mapped) throw new UnmappedStatusError(rawStatus);
  return mapped;
}

/** Non-throwing probe — true if the status is known. Used by validate-source to report
 *  every unmapped status at once rather than failing on the first. */
export function isMappableStatus(rawStatus: string): boolean {
  return normalizeKey(rawStatus) in STATUS_TABLE;
}

/** The set of canonical normalized keys — for tests and the mapping-coverage report. */
export function knownStatusKeys(): readonly string[] {
  return Object.keys(STATUS_TABLE);
}
