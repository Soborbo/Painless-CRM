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
