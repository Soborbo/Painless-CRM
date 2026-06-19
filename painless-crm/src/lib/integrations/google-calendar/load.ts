import {
  type BriefInput,
  type BriefKind,
  type BriefSurvey,
  assembleJobBrief,
} from '@/lib/calendar/brief';
import { type GoogleEventResource, briefToGoogleEvent } from '@/lib/calendar/event';
import type { createAdminClient } from '@/lib/supabase/admin';
import type { CalendarEntityType } from './links';

// Turns a survey / move entity into the Google event resource to push (ADR-045).
// Reads the scattered rows, folds them with the pure assembler (crew audience)
// and maps to an event. Returns null when the entity should NOT have an event —
// no scheduled time, or a cancelled / dead move — so the orchestrator deletes
// any existing one. The only I/O in the calendar feature; everything it calls is
// pure + unit-tested.

type AnyClient = ReturnType<typeof createAdminClient>;

// Move stages that must never appear on the calendar (→ delete any event).
const NON_SYNCABLE_MOVE_STAGES = new Set(['cancelled', 'declined', 'dead', 'lead']);

interface AddressEmbed {
  line1: string | null;
  line2: string | null;
  city: string | null;
  postcode: string | null;
}

function one<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
}

export function formatAddress(a: AddressEmbed | null): string {
  if (!a) return '';
  return [a.line1, a.line2, a.city, a.postcode].filter((p) => p?.trim()).join(', ');
}

function customerName(
  c: { first_name: string | null; last_name: string | null; company_name: string | null } | null,
): string {
  if (!c) return 'Customer';
  const person = [c.first_name, c.last_name].filter(Boolean).join(' ').trim();
  return c.company_name?.trim() || person || 'Customer';
}

interface SurveyRow {
  id: string;
  job_id: string;
  survey_type: string | null;
  scheduled_at: string | null;
  cubic_ft_estimate: number | null;
  notes_internal: string | null;
  notes_for_customer: string | null;
}

function toBriefSurvey(s: SurveyRow): BriefSurvey {
  return {
    survey_type: s.survey_type,
    scheduled_at: s.scheduled_at,
    surveyor_name: null,
    cubic_ft_estimate: s.cubic_ft_estimate,
    notes_internal: s.notes_internal,
    notes_for_customer: s.notes_for_customer,
  };
}

const SURVEY_COLS =
  'id, job_id, survey_type, scheduled_at, cubic_ft_estimate, notes_internal, notes_for_customer';

async function loadSurveyById(supabase: AnyClient, surveyId: string): Promise<SurveyRow | null> {
  const { data } = await supabase
    .from('surveys')
    .select(SURVEY_COLS)
    .eq('id', surveyId)
    .is('deleted_at', null)
    .maybeSingle();
  return (data as unknown as SurveyRow | null) ?? null;
}

async function loadLatestSurvey(supabase: AnyClient, jobId: string): Promise<SurveyRow | null> {
  const { data } = await supabase
    .from('surveys')
    .select(SURVEY_COLS)
    .eq('job_id', jobId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as unknown as SurveyRow | null) ?? null;
}

async function loadJobInput(
  supabase: AnyClient,
  jobId: string,
  kind: BriefKind,
  survey: SurveyRow | null,
): Promise<BriefInput | null> {
  const { data: jobRaw } = await supabase
    .from('jobs')
    .select(
      'job_number, stage, move_date, arrival_window, notes, ' +
        'customer:customers(first_name, last_name, company_name, primary_phone)',
    )
    .eq('id', jobId)
    .is('deleted_at', null)
    .maybeSingle();
  if (!jobRaw) return null;
  const job = jobRaw as unknown as {
    job_number: string;
    stage: string;
    move_date: string | null;
    arrival_window: string | null;
    notes: string | null;
    customer:
      | {
          first_name: string | null;
          last_name: string | null;
          company_name: string | null;
          primary_phone: string | null;
        }
      | Array<{
          first_name: string | null;
          last_name: string | null;
          company_name: string | null;
          primary_phone: string | null;
        }>
      | null;
  };
  const customer = one(job.customer);

  const [addressRows, cubicRows, briefRows, noteRows, taskRows] = await Promise.all([
    supabase
      .from('job_addresses')
      .select(
        'role, sequence, property_type, floor, has_lift, has_parking, access_notes, ' +
          'address:addresses(line1, line2, city, postcode)',
      )
      .eq('job_id', jobId)
      .is('deleted_at', null),
    survey
      ? supabase
          .from('cubic_sheet_items')
          .select('room, item, quantity, dismantle_required, reassembly_required')
          .eq('survey_id', survey.id)
      : Promise.resolve({ data: [] }),
    supabase
      .from('job_brief_items')
      .select('kind, item, quantity, notes')
      .eq('job_id', jobId)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true }),
    supabase
      .from('notes')
      .select('category, body')
      .eq('parent_type', 'job')
      .eq('parent_id', jobId)
      .is('deleted_at', null),
    supabase
      .from('tasks')
      .select('title, status, due_at')
      .eq('job_id', jobId)
      .is('deleted_at', null)
      .in('status', ['open', 'in_progress']),
  ]);

  const addresses = (
    (addressRows.data ?? []) as unknown as Array<{
      role: 'from' | 'to' | 'via';
      sequence: number | null;
      property_type: string | null;
      floor: number | null;
      has_lift: boolean | null;
      has_parking: boolean | null;
      access_notes: string | null;
      address: AddressEmbed | AddressEmbed[] | null;
    }>
  ).map((a) => ({
    role: a.role,
    sequence: a.sequence ?? 0,
    formatted: formatAddress(one(a.address)),
    property_type: a.property_type,
    floor: a.floor,
    has_lift: a.has_lift,
    has_parking: a.has_parking,
    access_notes: a.access_notes,
  }));

  return {
    kind,
    job: {
      job_number: job.job_number,
      stage: job.stage,
      move_date: job.move_date,
      arrival_window: job.arrival_window,
      customer_name: customerName(customer),
      customer_phone: customer?.primary_phone ?? null,
      notes: job.notes,
    },
    addresses,
    survey: survey ? toBriefSurvey(survey) : null,
    cubicItems: (cubicRows.data ?? []) as BriefInput['cubicItems'],
    briefItems: (briefRows.data ?? []) as BriefInput['briefItems'],
    notes: (noteRows.data ?? []) as BriefInput['notes'],
    openTasks: (taskRows.data ?? []) as BriefInput['openTasks'],
  };
}

export async function buildEntityEvent(
  supabase: AnyClient,
  entityType: CalendarEntityType,
  entityId: string,
): Promise<GoogleEventResource | null> {
  if (entityType === 'survey') {
    const survey = await loadSurveyById(supabase, entityId);
    if (!survey?.scheduled_at) return null;
    const input = await loadJobInput(supabase, survey.job_id, 'survey', survey);
    if (!input) return null;
    return briefToGoogleEvent(assembleJobBrief(input, 'crew'), { entityType, entityId });
  }

  const survey = await loadLatestSurvey(supabase, entityId);
  const input = await loadJobInput(supabase, entityId, 'move', survey);
  if (!input || NON_SYNCABLE_MOVE_STAGES.has(input.job.stage)) return null;
  return briefToGoogleEvent(assembleJobBrief(input, 'crew'), { entityType, entityId });
}
