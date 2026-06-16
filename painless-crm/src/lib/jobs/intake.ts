import { computeFirstResponseDueAt } from '@/lib/jobs/sla-deadline';
import { ACQUISITION_SOURCES } from '@/lib/schemas/job';
import { createAdminClient } from '@/lib/supabase/admin';
import { z } from 'zod';

// Shared lead-intake helpers reused by every inbound webhook (quote, contact,
// callback, clearance-callback…). Each ingestor builds on these primitives so
// customer dedup, job-number sequencing, and audit trail stay consistent.

const ukPhone = z
  .string()
  .trim()
  .min(7)
  .max(20)
  .regex(/^[+0-9 ()-]+$/);

export const ContactDetailsSchema = z.object({
  full_name: z.string().min(1).max(160),
  email: z.string().email().max(160),
  phone: ukPhone,
  postcode: z.string().min(2).max(12).optional(),
});

export type ContactDetails = z.infer<typeof ContactDetailsSchema>;

export function splitName(fullName: string): { first: string | null; last: string | null } {
  const trimmed = fullName.trim();
  if (!trimmed) return { first: null, last: null };
  const [first, ...rest] = trimmed.split(/\s+/);
  if (!first) return { first: null, last: null };
  if (rest.length === 0) return { first, last: null };
  return { first, last: rest.join(' ') };
}

export function normaliseSource(source: string): string {
  const found = ACQUISITION_SOURCES.find((s) => s === source);
  return found ?? 'website';
}

export async function nextJobNumber(companyId: string): Promise<string> {
  const supabase = createAdminClient();
  const year = new Date().getUTCFullYear();
  const { data } = await supabase
    .from('jobs')
    .select('job_number')
    .eq('company_id', companyId)
    .ilike('job_number', `J${year}-%`)
    .order('job_number', { ascending: false })
    .limit(1)
    .maybeSingle();
  let next = 1;
  if (data?.job_number) {
    const match = /J\d{4}-(\d+)/.exec(data.job_number as string);
    if (match?.[1]) next = Number.parseInt(match[1], 10) + 1;
  }
  return `J${year}-${String(next).padStart(5, '0')}`;
}

export async function findOrCreateCustomer(args: {
  companyId: string;
  contact: ContactDetails;
  source: string;
}): Promise<string> {
  const supabase = createAdminClient();
  const { data: existing } = await supabase
    .from('customers')
    .select('id')
    .eq('company_id', args.companyId)
    .eq('primary_email', args.contact.email)
    .is('deleted_at', null)
    .maybeSingle();
  if (existing) return existing.id as string;

  const { first, last } = splitName(args.contact.full_name);
  const { data, error } = await supabase
    .from('customers')
    .insert({
      company_id: args.companyId,
      customer_type: 'individual',
      first_name: first,
      last_name: last,
      primary_email: args.contact.email,
      primary_phone: args.contact.phone,
      acquisition_source: normaliseSource(args.source),
      first_contact_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (error || !data) {
    throw new Error(`Could not create customer: ${error?.message ?? 'unknown'}`);
  }
  return data.id as string;
}

export interface CreateLeadInput {
  companyId: string;
  customerId: string;
  source: string;
  notes?: string | null;
  quoteTotalPence?: number | null;
  reason: string;
  // Optional rich intake fields (quote webhook). All additive — other callers
  // (contact/callback) simply omit them.
  moveDate?: string | null;
  serviceType?: 'removal' | 'waste_clearance' | 'storage' | null;
  estimatedCubicFt?: number | null;
  estimatedDistanceMiles?: number | null;
  estimatedHours?: number | null;
  /** Lossless map of every entered item with no dedicated column (jobs.intake_details). */
  intakeDetails?: Record<string, unknown> | null;
}

export async function createLeadJob(input: CreateLeadInput): Promise<string> {
  const supabase = createAdminClient();
  const jobNumber = await nextJobNumber(input.companyId);
  const enquiryAt = new Date().toISOString();
  const source = normaliseSource(input.source);
  const firstResponseDueAt = computeFirstResponseDueAt(enquiryAt, source);
  const { data, error } = await supabase
    .from('jobs')
    .insert({
      company_id: input.companyId,
      job_number: jobNumber,
      customer_id: input.customerId,
      stage: 'lead',
      acquisition_source: source,
      enquiry_at: enquiryAt,
      first_response_due_at: firstResponseDueAt,
      quote_total_pence: input.quoteTotalPence ?? null,
      notes: input.notes ?? null,
      ...(input.moveDate ? { move_date: input.moveDate } : {}),
      ...(input.serviceType ? { service_type: input.serviceType } : {}),
      ...(input.estimatedCubicFt != null ? { estimated_cubic_ft: input.estimatedCubicFt } : {}),
      ...(input.estimatedDistanceMiles != null
        ? { estimated_distance_miles: input.estimatedDistanceMiles }
        : {}),
      ...(input.estimatedHours != null ? { estimated_hours: input.estimatedHours } : {}),
      ...(input.intakeDetails && Object.keys(input.intakeDetails).length > 0
        ? { intake_details: input.intakeDetails }
        : {}),
    })
    .select('id')
    .single();
  if (error || !data) {
    throw new Error(`Could not create job: ${error?.message ?? 'unknown'}`);
  }
  await supabase.from('job_status_history').insert({
    company_id: input.companyId,
    job_id: data.id,
    from_stage: null,
    to_stage: 'lead',
    reason: input.reason,
  });
  return data.id as string;
}

export interface IntakeAddress {
  formatted?: string;
  line1?: string;
  line2?: string | null;
  city?: string;
  postcode: string;
  floor?: number;
  has_lift?: boolean;
  property_type?: string;
  access_notes?: string;
}

/**
 * Find-or-create an `addresses` row (respecting the company+dedup_key unique
 * index) and return its id. line1/city are required-not-null on the table, so
 * the calculator's single `formatted` string is used as line1 when no
 * structured line1 is supplied.
 */
async function findOrCreateAddress(
  companyId: string,
  addr: IntakeAddress,
): Promise<string | null> {
  const supabase = createAdminClient();
  const line1 = (addr.line1 || addr.formatted || addr.postcode).slice(0, 160);
  const city = (addr.city || '').slice(0, 80);
  const insert = {
    company_id: companyId,
    line1,
    line2: addr.line2 ?? null,
    city,
    postcode: addr.postcode,
  };
  const { data, error } = await supabase
    .from('addresses')
    .insert(insert)
    .select('id')
    .single();
  if (!error && data) return data.id as string;

  // Unique-violation on (company_id, dedup_key) → fetch the existing row.
  if (error?.code === '23505') {
    const dedupLine1 = line1.replace(/\s+/g, '').toLowerCase();
    const dedupPost = addr.postcode.replace(/\s+/g, '').toLowerCase();
    const { data: existing } = await supabase
      .from('addresses')
      .select('id')
      .eq('company_id', companyId)
      .eq('dedup_key', `${dedupLine1}|${dedupPost}`)
      .is('deleted_at', null)
      .maybeSingle();
    if (existing) return existing.id as string;
  }
  console.warn('address create failed', error?.message);
  return null;
}

/**
 * Attach a `from`/`to` address pair to a job: creates/links the addresses and
 * stores per-leg access metadata (floor, lift, property type, notes) on
 * job_addresses. Best-effort — a failure here never rolls back the lead.
 */
export async function attachJobAddresses(args: {
  companyId: string;
  jobId: string;
  from?: IntakeAddress;
  to?: IntakeAddress;
}): Promise<void> {
  const supabase = createAdminClient();
  const legs: Array<{ role: 'from' | 'to'; addr: IntakeAddress }> = [];
  if (args.from) legs.push({ role: 'from', addr: args.from });
  if (args.to) legs.push({ role: 'to', addr: args.to });

  for (const [sequence, { role, addr }] of legs.entries()) {
    const addressId = await findOrCreateAddress(args.companyId, addr);
    if (!addressId) continue;
    const { error } = await supabase.from('job_addresses').insert({
      company_id: args.companyId,
      job_id: args.jobId,
      address_id: addressId,
      role,
      sequence,
      property_type: addr.property_type ?? null,
      floor: addr.floor ?? null,
      has_lift: addr.has_lift ?? null,
      access_notes: addr.access_notes ?? null,
    });
    if (error) console.warn('job_address link failed', role, error.message);
  }
}
