import { type BriefInput, type JobBrief, assembleJobBrief } from '@/lib/calendar/brief';
import { createClient } from '@/lib/supabase/server';

// The crew's job brief for the worker PWA (ADR-045) — the SAME pure assembler the
// calendar event uses, so the van team sees the full picture (addresses + access,
// kit, dismantle/reassemble, "not going", notes) whether or not they subscribed
// to the Google calendar. RLS-scoped (createClient): a worker reads it only for a
// job in their company. Office-only admin notes are filtered out here.

interface AddressEmbed {
  line1: string | null;
  line2: string | null;
  city: string | null;
  postcode: string | null;
}

interface CustomerEmbed {
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  primary_phone: string | null;
}

function one<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
}

function formatAddress(a: AddressEmbed | null): string {
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

export async function getWorkerBrief(jobId: string): Promise<JobBrief | null> {
  const supabase = await createClient();
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
    customer: CustomerEmbed | CustomerEmbed[] | null;
  };
  const customer = one(job.customer);

  const { data: surveyRaw } = await supabase
    .from('surveys')
    .select('id, survey_type, scheduled_at, cubic_ft_estimate, notes_internal, notes_for_customer')
    .eq('job_id', jobId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const survey = surveyRaw as {
    id: string;
    survey_type: string | null;
    scheduled_at: string | null;
    cubic_ft_estimate: number | null;
    notes_internal: string | null;
    notes_for_customer: string | null;
  } | null;

  const [addrRows, cubicRows, briefRows, noteRows] = await Promise.all([
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
      .is('deleted_at', null)
      .in('category', ['staff', 'customer_visible']),
  ]);

  const addresses = (
    (addrRows.data ?? []) as unknown as Array<{
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

  const input: BriefInput = {
    kind: 'move',
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
    survey: survey
      ? {
          survey_type: survey.survey_type,
          scheduled_at: survey.scheduled_at,
          surveyor_name: null,
          cubic_ft_estimate: survey.cubic_ft_estimate,
          notes_internal: survey.notes_internal,
          notes_for_customer: survey.notes_for_customer,
        }
      : null,
    cubicItems: (cubicRows.data ?? []) as BriefInput['cubicItems'],
    briefItems: (briefRows.data ?? []) as BriefInput['briefItems'],
    notes: (noteRows.data ?? []) as BriefInput['notes'],
    openTasks: [],
  };

  return assembleJobBrief(input, 'crew');
}
