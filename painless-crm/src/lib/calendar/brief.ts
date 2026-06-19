// Phase 28 — Calendar job-brief assembler (ADR-045). Pure: it folds the
// scattered job / survey / address / item rows the caller has already fetched
// into one typed brief, filtered by audience, so it unit-tests with no I/O and
// is reused by every sink (Google Calendar event today, an .ics later).

export const BRIEF_ITEM_KINDS = ['kit', 'excluded'] as const;
export type BriefItemKind = (typeof BRIEF_ITEM_KINDS)[number];

export const BRIEF_AUDIENCES = ['crew', 'customer'] as const;
export type BriefAudience = (typeof BRIEF_AUDIENCES)[number];

export type BriefKind = 'survey' | 'move';
export type AddressRole = 'from' | 'to' | 'via';

// ---- Inputs: rows the caller has already joined/fetched (no I/O here) -------
export interface BriefJob {
  job_number: string;
  stage: string;
  move_date: string | null; // ISO timestamp
  arrival_window: string | null; // customer-facing crew slot text (ADR-026)
  customer_name: string;
  customer_phone: string | null;
  notes: string | null; // jobs.notes (admin freeform)
}

export interface BriefAddress {
  role: AddressRole;
  sequence: number;
  formatted: string; // one-line address built by the caller
  property_type: string | null;
  floor: number | null;
  has_lift: boolean | null;
  has_parking: boolean | null;
  access_notes: string | null;
}

export interface BriefSurvey {
  survey_type: string | null;
  scheduled_at: string | null; // ISO
  surveyor_name: string | null;
  cubic_ft_estimate: number | null;
  notes_internal: string | null;
  notes_for_customer: string | null;
}

export interface BriefCubicItem {
  room: string | null;
  item: string;
  quantity: number;
  dismantle_required: boolean;
  reassembly_required: boolean;
}

export interface BriefItem {
  kind: BriefItemKind;
  item: string;
  quantity: number;
  notes: string | null;
}

export interface BriefNote {
  category: 'admin' | 'staff' | 'customer_visible';
  body: string;
}

export interface BriefTask {
  title: string;
  status: string;
  due_at: string | null;
}

export interface BriefInput {
  kind: BriefKind;
  job: BriefJob;
  addresses: BriefAddress[];
  survey: BriefSurvey | null;
  cubicItems: BriefCubicItem[];
  briefItems: BriefItem[];
  notes: BriefNote[];
  openTasks: BriefTask[];
}

// ---- Output ----------------------------------------------------------------
export interface BriefLeg {
  role: AddressRole;
  address: string;
  property_type: string | null;
  floor: number | null;
  has_lift: boolean | null;
  has_parking: boolean | null;
  access_notes: string | null; // crew only
}

export interface JobBrief {
  audience: BriefAudience;
  kind: BriefKind;
  jobNumber: string;
  title: string;
  customerName: string;
  customerPhone: string | null; // crew only
  whenStart: string | null;
  arrivalWindow: string | null;
  legs: BriefLeg[];
  dismantle: BriefCubicItem[]; // crew only
  reassembly: BriefCubicItem[]; // crew only
  kit: BriefItem[]; // crew only
  excluded: BriefItem[]; // crew only
  internalNotes: string[]; // crew only
  customerNotes: string[];
  openTasks: BriefTask[]; // crew only
  cubicEstimate: number | null; // crew only
}

const ROLE_ORDER: Record<AddressRole, number> = { from: 0, via: 1, to: 2 };

const nonEmpty = (s: string | null | undefined): s is string => Boolean(s?.trim());

function sortedLegs(addresses: readonly BriefAddress[], crew: boolean): BriefLeg[] {
  return [...addresses]
    .sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.sequence - b.sequence)
    .map((a) => ({
      role: a.role,
      address: a.formatted,
      property_type: a.property_type,
      floor: a.floor,
      has_lift: a.has_lift,
      has_parking: a.has_parking,
      access_notes: crew ? a.access_notes : null,
    }));
}

// Fold the inputs into a single brief. `audience` is the PII boundary: a crew
// brief carries everything; a customer brief drops phone, kit, excluded,
// dismantle/reassembly, internal notes, open tasks, volume and access notes.
export function assembleJobBrief(input: BriefInput, audience: BriefAudience): JobBrief {
  const crew = audience === 'crew';
  const { job, survey } = input;
  const whenStart = input.kind === 'survey' ? (survey?.scheduled_at ?? null) : job.move_date;

  const internalNotes = crew
    ? [job.notes, survey?.notes_internal ?? null]
        .concat(input.notes.filter((n) => n.category !== 'customer_visible').map((n) => n.body))
        .filter(nonEmpty)
    : [];

  const customerNotes = [survey?.notes_for_customer ?? null]
    .concat(input.notes.filter((n) => n.category === 'customer_visible').map((n) => n.body))
    .filter(nonEmpty);

  return {
    audience,
    kind: input.kind,
    jobNumber: job.job_number,
    title: `${input.kind === 'survey' ? 'Survey' : 'Move'} — ${job.customer_name} (${job.job_number})`,
    customerName: job.customer_name,
    customerPhone: crew ? job.customer_phone : null,
    whenStart,
    arrivalWindow: job.arrival_window,
    legs: sortedLegs(input.addresses, crew),
    dismantle: crew ? input.cubicItems.filter((i) => i.dismantle_required) : [],
    reassembly: crew ? input.cubicItems.filter((i) => i.reassembly_required) : [],
    kit: crew ? input.briefItems.filter((i) => i.kind === 'kit') : [],
    excluded: crew ? input.briefItems.filter((i) => i.kind === 'excluded') : [],
    internalNotes,
    customerNotes,
    openTasks: crew
      ? input.openTasks.filter((t) => t.status !== 'done' && t.status !== 'cancelled')
      : [],
    cubicEstimate: crew ? (survey?.cubic_ft_estimate ?? null) : null,
  };
}
